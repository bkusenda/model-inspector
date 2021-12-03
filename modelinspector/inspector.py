from .vis_utils import build_net_image
from .modelgraph import ModelGraph, \
    DataGroupType_BUFFER, \
    DataGroupType_INPUT, \
    DataGroupType_LABEL, \
    DataGroupType_LOSS, \
    DataGroupType_OUTPUT, \
    DataGroupType_PARAM, \
    DataGroupType_UNKNOWN
import cv2
import time
import inspect
import ast
import torch
from typing import Any, Dict, List
import numpy as np
# Functions for getting call order
from typing import Dict, List, Any
from collections import OrderedDict
from scipy import stats as scistats
import copy

from enum import Enum


stats_suffix = "__stats"

def compute_delta_fn(x0, x1): return x1-x0

def apply_function_to_states(
        source0,
        source1,
        target,
        included_data_groups_types = [DataGroupType_PARAM],
        value_name0='tensor',  # tensor or grad
        value_name1='tensor',
        fn=compute_delta_fn,
        target_value_name='first_delta'):
    for data_name0,data0 in source1['data'].items():
        if data0['data_group_type'] in included_data_groups_types and value_name0 in source0['data'][data_name0]['value']:
            v0 = source0['data'][data_name0]['value'][value_name0]
            v1 = source1['data'][data_name0]['value'][value_name1]
            result = fn(v0, v1)
            target['data'][data_name0]['value'][target_value_name] = result
    return


def compute_sum_fn(x0, x1): return x0 + np.abs(x1)


def get_id(epoch,itr):
    return "{}_{}".format(epoch,itr)

import os
import json
from .vis_utils import get_concat_v_blank, resize_img, heatmap_legend, get_concat_h_blank

def make_image(v, 
               value_name, 
               use_color_for_3channel_data=False):
    min_width = 400
    min_height = 60
    
    stats_value_name = '{}{}'.format(value_name,stats_suffix)
    
    if value_name not in v or stats_value_name not in v:
        return None
    stats = v[stats_value_name]
    
    img = tensor_to_image(
            val = v[value_name],
            vstats = stats,
            use_color_for_3channel_data = use_color_for_3channel_data)
    
    h = max(img.size[1],min_height) 
    w = max(img.size[0],min_width) 
    img = resize_img(img,w=w,min_h=h)
#     Add HM legend
    if not use_color_for_3channel_data:
        legimg = heatmap_legend(stats['min'],stats['max'])
        img = get_concat_h_blank(img,legimg)
    return img

def build_state_images(
                state,
                state_stats=None):
    
    state_image_data = {}
    for group_name, group_data in state['data'].items():
        image_data = {}
        for value_name in ['tensor','grad','first_delta']:
            
            img = make_image(
                    v = group_data['value'],
                    value_name = value_name,
                    use_color_for_3channel_data=group_data['data_group_type'] == DataGroupType_INPUT)
            if img is not None:
                image_data["{}__image".format(value_name)] = img
        state_image_data[group_name] = image_data
        
    return state_image_data

def build_cyto_graph_file(graph):
    nodes = []
    edges = []
    only_one_input = []
    for nid,node in graph.nodes.items():
        nodes.append({"data":{"id":nid,'label':node['op_type'],'component_ids':node['component_ids']}})

    for eid,edge in graph.edges.items():
        edges.append({'data':{'id':eid,"source":edge['source_id'],'target':edge['target_id']}})
        
    return {'nodes':nodes,'edges':edges}

import simplejson as json
import numpy as np
import numpy
import math
class StateEncoder(json.JSONEncoder):
    """
    Source: Modified from stack overflow answer
    """
    
    def default(self, obj):
        try:
            if isinstance(obj, type):
                return str(obj.__name__)
            elif isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                np.int16, np.int32, np.int64, np.uint8,
                np.uint16, np.uint32, np.uint64)):
                val = int(obj)
                return val
            elif isinstance(obj, (np.float_, np.float16, np.float32, 
                np.float64)):
                val =  float(obj)
                return val
            elif isinstance(obj,(numpy.ndarray,)) or isinstance(obj,np.ndarray): #### This is the fix
                if(obj.size <=200):
                    return obj.tolist()
                else:
                    return "NOT SERIALIZED, Too large {}".format(obj.size)
            else:
                return json.JSONEncoder.default(self, obj)
        except TypeError as te:
            print(type(obj))
            raise te

def save_images(state_image_data,output_path): #TODO: use these):
    filenames = {}
    os.makedirs(output_path,exist_ok=True)
    for group_name, image_data in state_image_data.items():
        filename_list = []
        for img_name,img in image_data.items():
            filename = "{}_{}.jpg".format(group_name,img_name)
            filename_list.append({'filename':filename,'size': img.size})
            try:
                img.save(os.path.join(output_path,filename))
            except Exception as e:
                print("Failure saving file {}, {}".format(filename,e))
                
        state_image_data[group_name] = image_data
        filenames[group_name] = filename_list
        
    return filenames

from shutil import copyfile


def save_session(inspector,session_id,session_root):
    filename = "session{}.json"
    session_data = {
        'session_id': session_id,
        'session_metrics': { v['id']:v for v in inspector.metrics_log},
        'metric_ids':[s['id'] for s in inspector.metrics_log],
        'state_ids':inspector.state_ids
    }
    os.makedirs(session_root,exist_ok=True)
    with open(os.path.join(session_root, filename.format("_tmp")),'w') as f:
        json.dump(session_data,f,cls=StateEncoder,ignore_nan=True)
    if os.path.exists(os.path.join(session_root, filename.format(""))):
        copyfile(os.path.join(session_root, filename.format("")), os.path.join(session_root, filename.format("_old")))
    copyfile(os.path.join(session_root, filename.format("_tmp")), os.path.join(session_root, filename.format("")))

def save_last_state(inspector,session_root):
    state = inspector.state_last
    print("Saving {}".format(state['id']))

    state_image_data = build_state_images(state)
    graph = inspector.graph_data[state['graph_id']]
    
    graph_out = build_cyto_graph_file(graph)
    state['graph'] = graph_out
    
    # Paths
    state_path= os.path.join(session_root,state['id'])
    image_path = os.path.join(state_path,"images")
    os.makedirs(image_path,exist_ok=True)
    save_images(state_image_data,image_path)

    with open(os.path.join(state_path, "state.json"),'w') as f:
        print(state_path)
        json.dump(state,f,cls=StateEncoder,ignore_nan=True)

from .vis_utils import tensor_to_image, tensor_to_dist, create_videos_for_session

    
class Inspector:
    """
    LIMITATION: Does not correctly generate graph for dynamic models

    Currently eveything is stored as dicts, TODO: consider migrating to classes
    step_data -> data (data_name) -> values (value_name)
    TODO: add number of parameters as statistic, add number of udpated parameters as statistic

    """

    def __init__(self,session_id,data_root):

        self.data_root = data_root
        self.session_root = os.path.join(data_root,session_id)
        os.makedirs(self.session_root,exist_ok=True)
        self.session_id = session_id

        self.state_ids = []
        self.global_stats = {}
        self.state_stats = []

        self.state_first = None
        self.state_last = None

        # Model Graph Data
        self.graph_data={}
        self.last_graph_id = None

        self.metrics_log = []

    def log_metrics(
        self,
        epoch: int,
        itr: int,
        metrics: Dict[str,Any]):

        self.metrics_log.append({'id': get_id(epoch,itr),'epoch': epoch, 'iter': itr, 'metrics':metrics})

        save_session(self,self.session_id,self.session_root)

    def log_state(
            self,
            epoch: int,
            itr: int,
            model,
            input_dict={},
            output_dict={},
            refresh_model_graph = False,
            additional_info={}):
        """
        Record Model State
        """
    
        state = {}
        state['id'] = get_id(epoch,itr)
        state['meta'] = {}
        state['meta']['time'] = time.time()
        state['step_info'] = {'epoch': epoch, 'iter': itr}
        state['additional_info'] = {}
        for k,v in additional_info.items():
            state['additional_info'][k] = {}
            state['additional_info'][k]['type'] = type(v)
            try:
                state['additional_info'][k]['value'] = v.data.cpu().numpy()
            except:
                state['additional_info'][k]['value'] = v

        if self.last_graph_id is None or refresh_model_graph:
            self.last_graph_id = (epoch,itr)
            print("Computing graph {}..".format(self.last_graph_id))
            model_input  = list(input_dict.values())[0] if len(input_dict) == 1 else list(input_dict.values())
            self.graph_data[self.last_graph_id] = ModelGraph.instance_from_torch_model(model, model_input)
        
        state['graph_id'] = self.last_graph_id
        state['meta']['refresh_model_graph'] = refresh_model_graph

        # LOG DATA GROUPS

        # PARAMETERS
        state['data'] = {}
        for eid, entity in model.named_parameters():
            data = {}
            data['id'] = eid
            data['data_group_type'] = DataGroupType_PARAM
            data['type'] = type(entity)
            data['value'] = {}
            data['value']['tensor'] = entity.data.cpu().numpy()
            data['value']['grad'] = entity.grad.data.cpu().numpy()
            data['shape'] = data['value']['tensor'].shape
            state['data'][eid] = data

        # BUFFERS
        for eid, entity in model.named_buffers():
            data = {}
            data['id'] = eid
            data['data_group_type'] = DataGroupType_BUFFER
            data['type'] = type(entity)
            data['value'] = {}
            data['value']['tensor'] = entity.data.cpu().numpy()
            data['shape'] = data['value']['tensor'].shape
            state['data'][eid] = data

        # Other
        additional_buffer_data = zip(
            [DataGroupType_INPUT, DataGroupType_OUTPUT, DataGroupType_LABEL, DataGroupType_LOSS],
            [input_dict, output_dict])

        for data_group_type, data_dict in additional_buffer_data:
            for eid, entity in data_dict.items():
                data = {}
                data['id'] = eid

                data['data_group_type'] = data_group_type
                data['type'] = type(entity)
                
                data['value'] = {}
                data['value']['tensor'] = entity.data.cpu().numpy()
                data['shape'] = data['value']['tensor'].shape
                state['data'][eid] = data

        if self.state_first is None:
            self.state_first = copy.deepcopy(state)

        self.compute_param_deltas(state)
        stats = self.compute_stats_for_state(state)
        #self.state_stats.append(stats)
        self.state_last = state
        self.state_ids.append(state['id'])

        save_last_state(self,self.session_root)

    def compute_param_deltas(self, state):
        # Overall diff since, initialization
        apply_function_to_states(self.state_first,
                                state,
                                target=state,
                                included_data_groups_types= [DataGroupType_PARAM],
                                value_name0='tensor',
                                value_name1='tensor',
                                fn=compute_delta_fn,
                                target_value_name='first_delta')


    def compute_stats_for_state(self,state):
        results={}
        for k,data in state['data'].items():
            stats_data = {}
            for vname,value in data['value'].items():
                if stats_suffix not in vname:
                    stats_tmp = scistats.describe(value, axis=None)._asdict()
                    stats_updated={}
                    stats_updated['min'] = stats_tmp['minmax'][0]
                    stats_updated['max'] = stats_tmp['minmax'][1]
                    stats_updated['mean'] = stats_tmp['mean']
                    stats_updated['variance'] = stats_tmp['variance']
                    stats_updated['nobs'] = stats_tmp['nobs']
                    bins = int(min(max(5,np.sqrt(stats_tmp['nobs'])),100))
                    stats_updated['histogram_bins'] = bins
                    stats_updated['histogram'] = np.histogram(value,bins=bins)
                    stats_data["{}{}".format(vname,stats_suffix)] = stats_updated
            data['value'].update(stats_data)
            results[k]=stats_data
        return results


    def create_videos(self):
        create_videos_for_session(self.session_root)
