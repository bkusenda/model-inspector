# Model Inspector

## Overview
Model Inspector is a tool for visualizing a Deep Neural Network's internal's throughout training.  It consists of two components: a python logging tool and a web based UI for visualizating the logged data. Model Inspector was developed to visualize the internal state of a deep learning model during training when watching loss alone may not be helpful.  This is the case for many reinforcement learning algorithms.

*NOTE: While this tool may be helpful for some, it needs more work to be useful generally. At present, no additional improvements are planned.*

Version: **0.01-dev**

## [Demo](http://bkusenda.github.io/mi/model_inspector.html?session_id=minst1) ##

## Features
* Automatically parses NN architecture using pytorch ONNX export support
* Interactive Web UI driven by static data files
* Visualizations
    * Neural Network Graph Visualization
    * Heatmaps for parameters and parameter deltas (with animation over time)
    * Gradient and Parameter Histograms
    * Mean/Variance of parameters and gradients over time
    

## Limitations
* No easy way to compare multiple runs
* No visualizations for activations (easy fix)
* Ranges in heatmaps use value ranges within the sample since these images are generated at log time when global statists are not available.
* Only support for pytorch (shouldn't be too difficult to add others)
* Code not clean and bugs galore





**UI screenshot**

<img src="docs/mi_screen1.png" alt="drawing" style="width:800px;"/>


**Animation of the parameter delta (current value - initial values) changing over time.**

<img src="docs/networkani.gif" alt="drawing" style="width:600px;"/>



## Example Notebooks
* [MINST](pytorch_minst.ipynb) ([Demo](http://bkusenda.github.io/mi/model_inspector.html?session_id=minst1) )
* [RESNET](pytorch_minst.ipynb) (requires ImageNet)

### Installation

## Usage

Usage requires the following
1. Install model-inspector code base and dependencies
    ```
    git clone https://github.com/bkusenda/model-inspector
    pip install -r requirements.txt
    ```
1. Train a model and log to model-inspector. See Logger Usage below
1. Launch the Web UI and View results

### Logger Usage

For full example see: See  [pytorch_minst.ipynb](pytorch_minst.ipynb)

*NOTE: epoch must start at 0*

#### Import and initialize inspector

```python
data_root = 'graph_web/session_data'
session_id = "test1"

from modelinspector.inspector import Inspector
inspector = Inspector(session_id,data_root)
```

#### Log within training loop

```python
if i % log_metric_freq == 0:
    inspector.log_metrics(
        epoch=epoch,
        itr=i, 
        metrics={
            'loss':loss.item(),
            'acc1':acc1[0].item(),
            'acc5':acc5[0].item()})

if i % log_state_freq == 0:
    inspector.log_state(epoch=epoch,
                itr=i, 
                model=model,
                input_dict={'input.1':images},
                output_dict={'output.1':output},
                additional_info={
                    'loss':loss,
                    'class_label':target})
```
#### Web viewer

- All files are static and can be statically served
    - Example start webserver using python``` cd graph_web && python -m http.server 8001```

## Related Projects:
* https://github.com/waleedka/hiddenlayer/
