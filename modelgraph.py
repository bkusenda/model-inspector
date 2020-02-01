import onnx
import os
import torch
import time


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
    for inpt in node.input:
        try:
            inputs.append(int(inpt))
        except Exception:
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

class ModelGraph:

    def __init__(self, nodes, edges, components, input_node_set, output_node_set):
        self.nodes = nodes
        self.edges = edges
        self.components = components
        self.input_node_set = input_node_set
        self.output_node_set = output_node_set

    @staticmethod
    def instance_from_torch_model(model, model_input):
        proto_graph = get_onnx_model_from_torch(model, model_input).graph
        nodes = {}
        edges = []
        components = {}
        source_node_set = set()
        output_node_set = set()
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
                    edges.append({'source_id': src_id,'target_id': node_data['id']})
                    source_node_set.add(src_id)
                if len(inputs) == 0:
                    output_node_set.add(node_data['id'])
            except Exception as e:
                print("Failure parsing data from proto_node: {}".format(node))
                raise(e)

        # Decorate Components
        param_lookup = {k: v for k, v in model.named_parameters()}
        buffer_lookup = {k: v for k, v in model.named_buffers()}

        for cid, component in components.items():
            component['root'] = get_component_root(cid)
            component['parent'] = get_component_parent(cid)
            component['ctype'] = "UNKNOWN"
            if cid in param_lookup:
                component['ctype'] = 'PARAM'
            if cid in buffer_lookup:
                if component['ctype'] == 'PARAM':
                    raise Exception("component cannot be both PARAM and BUFFER")
                component['ctype'] = 'BUFFER'
        
        input_node_set = source_node_set - set(nodes.keys())
        return ModelGraph(nodes, edges, components, input_node_set, output_node_set)
