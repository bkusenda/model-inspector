import onnx
import os
import torch
import time

# Enums are worthless so using this instead
DataGroupType_PARAM = "PARAM"
DataGroupType_BUFFER = "BUFFER"
DataGroupType_INPUT = "INPUT"
DataGroupType_OUTPUT = "OUTPUT"
DataGroupType_LOSS = "LOSS"
DataGroupType_LABEL = "LABEL"
DataGroupType_UNKNOWN = "UNKNOWN"

def get_onnx_model_from_torch(torch_model, model_input):
    """
    convert

    """
    tmp_filename = '/tmp/onnx_{}'.format(time.time())
    torch.onnx.export(torch_model, model_input, tmp_filename)
    # SEE: https://pytorch.org/docs/stable/onnx.html
    onnx_model = onnx.load(tmp_filename)
    os.remove(tmp_filename)
    return onnx_model


def get_node_attributes(node):
    results = {}
    for attr in node.attribute:
        results[attr.name] = {'name': attr.name,
                              'type': attr.type,
                              'value': attr.f}
    return results


def get_node_inputs_and_components(node):
    inputs = []
    components = []
    for i,inpt in enumerate(node.input):
        try:
            inputs.append(int(inpt))
        except Exception:
            if i ==0:
                inputs.append(inpt)
            else:
                components.append(inpt)
    return inputs, components


def get_node_id(node):
    assert(len(node.output) == 1)
    return int(node.output[0])


def get_component_root(component_name):
    return component_name.split('.')[0]


def get_component_parent(component_name):
    return ".".join(component_name.split('.')[:-1])

# NOT IN USE - might be good for non model code traces
# def add_to_tri(items,tri ={},depth=0):
#     if len(items) == 0:
#         return
#     else:
#         nodes = tri.get('nodes',{})
#         subtri = nodes.get(items[0],{'depth':depth})
#         add_to_tri(items[1:],subtri,depth+1)
#         nodes[items[0]] = subtri
#         tri['nodes'] = nodes

# def build_tris(lst,delim = '.'):
#     tries = {}
#     for name in lst:
#         name_parts = name.split(delim)
#         root = name_parts[0]
#         tri = tries.get(root,{})
#         add_to_tri(name_parts,tri)
#         tries[root] = tri
#     return tries
# component_list = sorted(list(components.keys()))
# component_tri = build_tris(component_list)

# Not in Use
# def get_call_order_default(nn):
#     """
#     pass in the network, it's input and output variables.
#     the trace should include inputs and outputs
#     """
#     call_order = ['inputs']
#     for cname, c in nn.named_children():
#         call_order.append("self.{}".format(cname))
#     call_order.append('outputs')
#     call_order.append('labels')
#     call_order.append('labels')
#     return call_order


# def get_call_order_for_function(fn):
#     """
#     Gets the order of function calls and variable assignments in a provided function.
#     TODO: build simplified graph as well (include edges)
#     """
#     call_order = []

#     def crawl_ast(tree, depth=0):
#         if type(tree) == ast.Module:
#             for b in tree.body:
#                 crawl_ast(b, depth+1)
#         elif type(tree) == ast.FunctionDef:
#             for b in tree.body:
#                 crawl_ast(b, depth+1)
#         elif type(tree) == ast.Assign:
#             crawl_ast(tree.value, depth+1)
#             for t in tree.targets:
#                 if type(t) is not ast.Name:
#                     crawl_ast(t, depth+1)
#                 else:
#                     call_order.append(t.id)
#         elif type(tree) == ast.Call:
#             for arg in tree.args:
#                 crawl_ast(arg, depth+1)
#             crawl_ast(tree.func, depth+1)
#         elif type(tree) == ast.Attribute:
#             if type(tree.value) == ast.Name:
#                 fullname = "{}.{}".format(tree.value.id, tree.attr)
#                 call_order.append(fullname)
#             else:
#                 crawl_ast(tree.value, depth+1)
#         elif type(tree) == ast.Name:
#             call_order.append(tree.id)
#         # else:
#         #    print("unsupported type {}".format(type(tree)))
#     tree = ast.parse(inspect.getsource(fn).strip())
#     crawl_ast(tree)
#     return call_order
def get_input_node(node, op_type):
    node_data = {}
    node_data['id'] = node.name
    node_data['op_type'] = op_type
    node_data['component_ids'] = [node.name]
    node_data['tensor_type'] = { 
        'elem_type': node.type.tensor_type.elem_type
    }
    node_data['tensor_shape'] = tuple([s.dim_value for s in node.type.tensor_type.shape.dim])
    return node_data

def get_output_node(node, node_id):
    node_data = {}
    node_data['id'] = node_id
    node_data['op_type'] = 'OUTPUT'
    node_data['component_ids'] = [node_id]
    node_data['inputs'] = [node.name]
    node_data['tensor_type'] = { 
        'elem_type': node.type.tensor_type.elem_type
    }
    node_data['tensor_shape'] = tuple([s.dim_value for s in node.type.tensor_type.shape.dim])
    return node_data

class ModelGraph:

    def __init__(self, nodes, edges, components, input_node_ids, output_node_ids):
        self.nodes = nodes
        self.edges = edges
        self.components = components
        self.input_node_ids = input_node_ids
        self.output_node_ids = output_node_ids


    @staticmethod
    def instance_from_torch_model(model, model_input):
        proto_graph = get_onnx_model_from_torch(model, model_input).graph
        nodes = {}
        edges = {}
        components = {}


        # INPUT NODES
        input_node_ids = []
        for i, node in enumerate(proto_graph.input):
            node_data = get_input_node(node,op_type='INPUT')
            input_node_ids.append(node_data['id'])
            nodes[node_data['id']] = node_data

            #COMPONENT
            components[ node_data['id']] = {
                'id': node_data['id'], 
                'node_id': node_data['id'],
                'data_group_type': DataGroupType_INPUT,
                'root': "INPUT",
                'parent': "INPUT"}


        def get_op_type(nid):
            if nid not in nodes:
                return None
            else:
                return nodes[nid]['op_type']

        for i, node in enumerate(proto_graph.node):
            try:
                node_data = {}
                node_data['id'] = get_node_id(node)
                node_data['op_type'] = node.op_type
                inputs, component_ids = get_node_inputs_and_components(node)
                for cid in component_ids:
                    if cid in components:
                        raise Exception("Component id not unique")
                    components[cid] = {'id': cid, 'node_id': node_data['id']}
                node_data['component_ids'] = component_ids
                node_data['attributes'] = get_node_attributes(node)
                node_data['input_ids'] = inputs
                nodes[node_data['id']] = node_data
                for src_id in inputs:
                    edge_id = "{}_{}".format(src_id,node_data['id'])
                    edges[edge_id] = {'source_id': src_id,'target_id': node_data['id']}
            except Exception as e:
                print("Failure parsing data from proto_node: {}".format(node))
                raise(e)

        # Decorate Components
        param_lookup = {k: v for k, v in model.named_parameters()}
        buffer_lookup = {k: v for k, v in model.named_buffers()}

        for cid, component in components.items():
            component['root'] = get_component_root(cid)
            component['parent'] = get_component_parent(cid)    
            if cid in param_lookup:
                component['data_group_type'] = DataGroupType_PARAM
            if cid in buffer_lookup:
                if component.get('data_group_type',None) == DataGroupType_PARAM:
                    raise Exception("component cannot be both PARAM and BUFFER")
                component['data_group_type'] = DataGroupType_BUFFER
            if 'data_group_type' not in component:
                component['data_group_type'] = DataGroupType_UNKNOWN

        # OUTPUT NODES (need to create a new node here since the node listed is actually the operation right before the node)
        output_node_ids = []
        for i, node in enumerate(proto_graph.output):
            node_data = get_output_node(node, node_id = "output.{}".format(i+1))
            src_id = node.name

            output_node_ids.append(node_data['id'])
            nodes[node_data['id']] = node_data

            edge_id = "{}_{}".format(src_id,node_data['id'])
            edges[edge_id] = {'source_id': src_id,'target_id': node_data['id']}
            
            #COMPONENT
            components[ node_data['id']] = {
                'id': node_data['id'], 
                'node_id': node_data['id'],
                'data_group_type': DataGroupType_OUTPUT,
                'root': "OUTPUT",
                'parent': "OUTPUT"}
        
        return ModelGraph(nodes, edges, components, input_node_ids, output_node_ids)
