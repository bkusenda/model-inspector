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
from scipy import stats


from enum import Enum


stats_suffix = "__stats"

def compute_delta_fn(x0, x1): return x1-x0

def apply_function_to_states(
        source0,
        source1,
        target,
        included_data_groups_types = [DataGroupType_PARAM],
        value_name0='tensor',  # param or grad
        value_name1='tensor',
        fn=compute_delta_fn,
        target_value_name='param_delta'):
    for data_name0,data0 in source1['data'].items():
        if data0['data_group_type'] in included_data_groups_types and value_name0 in source0['data'][data_name0]['value']:
            v0 = source0['data'][data_name0]['value'][value_name0]
            v1 = source1['data'][data_name0]['value'][value_name1]
            target['data'][data_name0]['value'][target_value_name] = fn(v0, v1)
    return


def compute_sum_fn(x0, x1): return x0 + np.abs(x1)


def get_id(epoch,itr):
    return "{}_{}".format(epoch,itr)

class Inspector:
    """
    LIMITATION: Does not correctly generate graph for dynamic models

    Currently eveything is stored as dicts, TODO: consider migrating to classes
    step_data -> data (data_name) -> values (value_name)
    TODO: add number of parameters as statistic, add number of udpated parameters as statistic

    """

    def __init__(self):
        self.state_log = []
        self.global_stats = {}

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

    def log_state(
            self,
            epoch: int,
            itr: int,
            model,
            input_dict={},
            output_dict={},
            label_dict={},
            loss_dict={},
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
        state['additional_info'] = additional_info

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
            data['internal_type'] = type(entity)
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
            [input_dict, output_dict, label_dict, loss_dict])

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
            self.state_first = state

        self.compute_param_deltas(state)
        self.state_last = state

        self.state_log.append(state)

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


    def _compute_stats_for_state(self,state):
        results={}
        for k,data in state['data'].items():
            stats_data = {}
            for vname,value in data['value'].items():
                if stats_suffix not in vname:
                    stats_tmp = stats.describe(value, axis=None)._asdict()
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

    def _compute_local_stats(self):
        data_group_names = set()
        stats_list = []
        for i, state in enumerate(self.state_log):
            state_stats = self._compute_stats_for_state(state)
            stats_list.append(state_stats)
            data_group_names = data_group_names.union(set(state_stats.keys()))
        return stats_list, data_group_names
        

    def _gather_all_state_stats(self,
                            stats_list:List[Dict[str,Any]], 
                            data_group_names:List[str]) -> Dict[str,Any]:
        stats_coll = {} 
        for group_name in data_group_names:
            stats_coll[group_name] = stats_coll.get(group_name,{})
            for stats_data in stats_list:
                for val_name, val_data in stats_data[group_name].items():
                    stats_coll[group_name][val_name] = stats_coll[group_name].get(
                        val_name,
                        {'min':[],'max':[],'mean':[],'variance':[],'skewness':[],'kurtosis':[]})

                    stats_coll[group_name][val_name]['min'].append(val_data['min'])
                    stats_coll[group_name][val_name]['max'].append(val_data['max'])
                    stats_coll[group_name][val_name]['mean'].append(val_data['mean'])
                    stats_coll[group_name][val_name]['variance'].append(val_data['variance'])
        return stats_coll

    def compute_stats(self):
        stats_list, data_group_names = self._compute_local_stats()
        stats_coll = self._gather_all_state_stats(stats_list,data_group_names)

        for data_name,data in stats_coll.items():
            self.global_stats[data_name] = self.global_stats.get(data_name,{})
            for value_name, stats_data in data.items():
                self.global_stats[data_name][value_name] = self.global_stats[data_name].get(value_name,{})
                self.global_stats[data_name] = self.global_stats.get(data_name,{})
                self.global_stats[data_name][value_name]['min'] = np.min(stats_data['min'])
                self.global_stats[data_name][value_name]['max'] = np.max(stats_data['max'])
                self.global_stats[data_name][value_name]['mean'] = np.mean(stats_data['mean'])
                self.global_stats[data_name][value_name]['variance'] = np.var(stats_data['variance'])


from .vis_utils import tensor_to_image, tensor_to_dist

def build_state_images(
                state,
                state_stats=None): #TODO: use these):
    results = {}
    for group_name, group_data in state['data'].items():
        image_data = {}
        if group_data['data_group_type'] is DataGroupType_PARAM:    
            #param
            param_stats = group_data['value']['tensor{}'.format(stats_suffix)] #TODO, use global stats
            image_data["tensor_image"] = tensor_to_image(
                val = group_data['value']['tensor'],
                vstats = tensor_stats)
            #grad
            grad_stats = group_data['value']['grad{}'.format(stats_suffix)] #TODO, use global stats
            image_data["grad__image"] = tensor_to_image(
                val = group_data['value']['grad'],
                vstats = grad_stats)
        elif group_data['data_group_type'] is DataGroupType_INPUT:
            image_data["tensor__image"] = tensor_to_image(
                val = group_data['value']['tensor'],
                vstats = None, 
                use_color_for_3channel_data=True)    
        elif group_data['data_group_type'] is DataGroupType_BUFFER:
            image_data["tensor__image"] = tensor_to_image(
                val = group_data['value']['tensor'],
                vstats = None, 
                use_color_for_3channel_data=False)
        elif group_data['data_group_type'] is DataGroupType_OUTPUT:
            image_data["tensor__image"] = tensor_to_image(
                val = group_data['value']['tensor'],
                vstats = None, 
                use_color_for_3channel_data=False)
        elif group_data['data_group_type'] is DataGroupType_LOSS:
            image_data["tensor__image"] = tensor_to_image(
                val = group_data['value']['tensor'],
                vstats = None, 
                use_color_for_3channel_data=False) 
        results[group_name] = image_data
    return results


def generate_video(
        spy: Inspector,
        forward_call_order,
        video_filename: str = None,
        time_steps_to_skip=5,
        fps=20,
        return_images=False):

    imgs = []
    out = None
    if video_filename is None:
        time_str = str(time.time()).replace('.', '_')
        video_filename = "nn_video__{}.mp4".format(time_str)

    print("building {} images for video".format(len(spy.data_log)/time_steps_to_skip))

    for i, trace in enumerate(spy.data_log):
        if (i+1) % time_steps_to_skip == 0:
            img = build_net_image(forward_call_order,
                                  trace,
                                  spy.global_data_stats,
                                  width=300,
                                  min_h=40,
                                  max_h=None,
                                  hide_tensors=False,
                                  ignore_resize=False)
            if out is None:
                out = cv2.VideoWriter(video_filename, cv2.VideoWriter_fourcc(*'DIVX'), fps, img.size)

            out.write(np.array(img.copy()))

            if return_images:
                imgs.append(img)
    out.release()

    if return_images:
        return imgs
    else:
        return None
