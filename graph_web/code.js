/**
 * # Overview:
 * 
 * This is a UI component for the Model Inspector a tool for visualization and debuging of Deep Neural Networks.
 * 
 * @author Brandyn Kusenda
 * 
 * Version: 0.01-alpha
 * Status: Under heavy development
 * 
 * Issues/Problems:
 * - coding style: inconistent methods of accessing data, sometimes via parameter sometimes via local storage or global variable
 * References: 
 * - https://stackoverflow.com/questions/40261292/put-a-cytoscape-graph-inside-a-bootstrap-column
 * - https://github.com/kaluginserg/cytoscape-node-html-label
*/


/**
 * Get the URL parameters
 * source: https://css-tricks.com/snippets/javascript/get-url-variables/
 * @param  {String} url The URL
 * @return {Object}     The URL parameters
 */
var getParams = function (url) {
  var params = {};
  var parser = document.createElement('a');
  parser.href = url;
  var query = parser.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    params[pair[0]] = decodeURIComponent(pair[1]);
  }
  return params;
};

let PARAMS = getParams(window.location.href);
var win = $(window);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function resize() {
  $("#cy-container").height(win.innerHeight() - 320);
  $("#node_info").css("height",win.innerHeight() - 460);
  cy.resize();
}

win.resize(function () {
  resize();
});


var dataViewElData = {
  view_buffer_btn: 'BUFFER_tensor',
  view_grad_btn: 'PARAM_grad',
  view_param_btn: 'PARAM_tensor'
}

var imageTypeElData = {
  hist_radio_btn: 'hist',
  session_stats_radio_btn: 'session_stats'
}

//STORAGE HELPERS
var defaultScalars = {
    'cy-layout': 'grid',
    'cy-font-size': 50,
    'cy-node-width': 460,
    'cy-node-height': 460,
    'cy-edge-size': 10,
    'play_mode': 'stop',
    'active_image': 'tensor',
    'node_render_type': 'fixed',
    'session_path': "session_data",
    'session_id': PARAMS.session_id,
    'state_id': PARAMS.state_id || "0_0",
    'state_idx': 0,
    'current_image_type': 'session_stats',
    'nonParamNodeSelector': 'node[label="Add"],node[label="Flatten"],node[label="MaxPool"],node[label="Relu"],node[label="Softmax"],node[label="LogSoftmax"],node[label="Constant"],node[label="Reshape"]',
    'selected_node_id': -1,
    'selected_node_label': ""
}

var defaultJSON = {
  'image_types': ['hist', 'session_stats'],
  'valid_data_group_types': [['PARAM', 'tensor'], ['PARAM', 'grad'], ['BUFFER', 'tensor'], ['INPUT', 'tensor'], ['OUTPUT', 'tensor'], ['PARAM', 'first_delta']],
  'current_data_group': ['PARAM', 'tensor']
}

function isJSONValue(key) {
  return (key in defaultJSON);
}

function setScalarValue(key, value) {
  localStorage.setItem(key, value);
  return value;
}

function getScalarValue(key, defaultValue = null) {
  if (defaultValue == null) {
    defaultValue = defaultScalars[key];
  }
  storageValue = localStorage.getItem(key)
  if (storageValue) {
    return storageValue;
  }
  else {
    return setScalarValue(key, defaultValue)
  }
}

function setJSONValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function getJSONValue(key, defaultValue = null) {
  if (defaultValue == null) {
    defaultValue = defaultJSON[key];
  }
  var storageValue = localStorage.getItem(key)
  if (storageValue) {
    return JSON.parse(storageValue)
  }
  else {
    return setJSONValue(key, defaultValue)
  }
}

// get/set storage (USE THIS)
function getStorageValue(key, defaultValue = null) {

  if (isJSONValue(key)) {
    return getJSONValue(key, defaultValue)
  }
  else {
    return getScalarValue(key, defaultValue)
  }
}

function setStorageValue(key, value) {
  if (isJSONValue(key)) {
    return setJSONValue(key, value)
  }
  else {
    return setScalarValue(key, value)
  }
}

function getDefaultValue(key) {
  if (isJSONValue(key)) {
    return defaultJSON[key];
  }
  else {
    return defaultScalars[key];
  }
}

function getSessionPath() {
  return `${getStorageValue('session_path')}/${getStorageValue('session_id')}`
}

function getStatePathFor(stateId) {
  return `${getSessionPath()}/${stateId}`;
}

function getStatePath() {
  return `${getSessionPath()}/${getStorageValue('state_id')}`;
}

function getLayoutConfig(name) {
  return {
    name: name,
    animate: false,
    directed: true,
    fit: true,
    spacingFactor: 1.2,
  };
}

async function updateLayout(name) {
  layoutConfig = getLayoutConfig(name);
  layout = cy.layout(layoutConfig);
  layout.run();
  setScalarValue('current_layout_name', name);
}

function refreshLayout() {
  current_layout_name = getStorageValue('current_layout_name', 'grid');
  updateLayout(current_layout_name);
}

function getCurrentState() {
  return window.appdata.stateData[getStorageValue("state_id")];
}

function getCurrentGraphData() {
  return getCurrentState().graph;
}

function getCurrentSessionData() {
  return window.appdata.sessionData;
}

function getNodeData(node_id) {
  return window.appdata.nodeData[getStorageValue("state_id")][node_id];
}

function updateStyle() {
  cy.style()
    .selector('node')
    .css({
      'height': getStorageValue('cy-node-height'),
      'width': getStorageValue('cy-node-width'),
      'font-size': getStorageValue('cy-font-size'),
      'content': function (n) {
        var data = n.data()
        return `${data.label}(${data.id})`
      },
      'shape': 'square',
    })
    .selector(getStorageValue('nonParamNodeSelector'))
    .css({
      
      'height': 200,
      'width': 200,
      'shape': 'diamond',
    })
    .selector('node[label="OUTPUT"]')
    .css({
      'height': 200,
      'width': 200,
      'shape': 'round-octagon',
    }).update();

  cy.nodes().leaves().style({
    'border-width': 20,
    'border-color': '#F00'
  });
  cy.nodes().roots().style({
    'border-width': 20,
    'border-color': '#0F0'
  });
}

const loadImage = (img) =>
  new Promise(resolve => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
  });

function makeImage(src) {
  let img = new Image();
  img.src = src;
  return img;
}

//Preloading so we can get images sizes before rendering graph as well as cache node images
const buildNodeInfo = async (node, state) => {
  let promise_list = [];
  let ndata = node.data
  let component_ids = ndata.component_ids;

  var image_info = {}
  var component_info = {};
  var dgt_data = {}

  //Gather info on components
  getStorageValue('image_types').forEach(
    function (img_type) {
      image_info[img_type] = {};
    });

  for (i = 0; i < component_ids.length; i++) {
    if (component_ids[i] in state['data']) {
      comp = component_ids[i];
      comp_data = state['data'][comp];
      component_info[comp] = comp_data;
      dgt = comp_data['data_group_type']
      if (!(dgt in dgt_data)) {
        dgt_data[dgt] = [];
      }
      dgt_data[dgt].push(comp_data)
    }
  }

  //CREATES/LOAD NODE IMAGES
  getStorageValue('valid_data_group_types').forEach(function (item, index) {
    let dgt = item[0]
    let vt = item[1]
    if (dgt in dgt_data) {
      var compList = dgt_data[dgt]
      //GEN GRAPHS
      getStorageValue('image_types').forEach(function (image_type, index2) {
        let statsList = []

        compList.forEach(function (comp) {
          let stat_info = {
            data_group_type: comp['data_group_type'],
            component: comp.id,
            stats: comp['value'][`${vt}__stats`]
          };

          statsList.push(stat_info);
        });

        //FOR DIST IMAGE
        //TODO Fix repeat code
        if (image_type == 'dist') {
          var plot_stats = []
          for (let i = 0; i < statsList.length; i++) {
            plot_stat = { ...statsList[i].stats }
            plot_stat['xlabel'] = `${statsList[i].component} - ${vt}`;
            plot_stats.push(plot_stat)
          }
          let plotCan = plotNormDistMulti(plot_stats,
            Width = getStorageValue('cy-node-width'),
            Height = getStorageValue('cy-node-height'));

          image_info[image_type][[dgt, vt]] = {
            src: plotCan.node().toDataURL(),
            height: plotCan.height,
            width: plotCan.width
          }

        }
        else if (image_type == 'hist') {
          var plot_stats = []
          for (let i = 0; i < statsList.length; i++) {
            plot_stat = { ...statsList[i].stats }
            plot_stat['xlabel'] = `${statsList[i].component} - ${vt}`;
            plot_stats.push(plot_stat)
          }
          let plotCan = plotMultiHist(plot_stats,
            Width = getStorageValue('cy-node-width'),
            Height = getStorageValue('cy-node-height'));

          image_info[image_type][[dgt, vt]] = {
            src: plotCan.node().toDataURL(),
            height: plotCan.height,
            width: plotCan.width
          }

        }
        else if (image_type == 'session_stats') {
          let comps = []
          let labels = []
          for (let i = 0; i < statsList.length; i++) {
            comps.push(statsList[i].component)
            labels.push(`${statsList[i].component} - ${vt}`)
          }

          let valueName = `${vt}__stats`
          let plotCan = plotMultiStatsOverTime(
            labels,
            comps,
            valueName,
            window.appdata.stateData,
            getStorageValue('state_id'),
            Width = getStorageValue('cy-node-width'),
            Height = getStorageValue('cy-node-height'));

          image_info[image_type][[dgt, vt]] = {
            src: plotCan.node().toDataURL(),
            height: plotCan.height,
            width: plotCan.width
          }

        }

      });

      //INPUTS GET IMAGE
      if (dgt == 'INPUT') {
        image_info['heatmap'] = {}
        compList.forEach(function (comp) {
          var image_path = `${getSessionPath()}/${state.id}/images/${comp.id}_${vt}__image.jpg`
          var img = makeImage(image_path)

          image_info['heatmap'][[dgt, vt]] = img
          promise_list.push(loadImage(img))
        })
      }
    }
  });

  //Gather results before proceeding to update global data
  var results = await Promise.all(promise_list)

  window.appdata['nodeData'][state.id][ndata.id] = {
    'component_info': component_info,
    'image_info': image_info
  }
  return results
}

const buildAllNodes = async (stateData) => {
  await Promise.all(stateData.graph.nodes.map(
    async function (node) {
      return await buildNodeInfo(node, stateData)
    }));
}


async function renderNodeImages() {

  let stateData = getCurrentState()

  if (getStorageValue('node_render_type') == 'fixed') {
    updateStyle();
  }

  let current_image_type = getStorageValue('current_image_type');
  let current_data_group = getStorageValue('current_data_group');

  function updateBackground(stateData) {
    return Promise.all(cy.nodes().map(async function (node) {
      let ndata = node.data();
      if (!(ndata.id in window.appdata['nodeData'][stateData.id])) {
        console.log(window.appdata['nodeData'][stateData.id].length)
        return
      }
      let nodeData = getNodeData(ndata.id);
      if (typeof (nodeData) == 'undefined') {
        return
      }


      let image_info = getNodeData(ndata.id).image_info;
      let node_data_group = current_data_group
      let node_image_type = current_image_type

      if (ndata.label == 'INPUT') {
        node_image_type = 'heatmap'
        node_data_group = ['INPUT', 'tensor']
      }

      if (node_image_type in image_info
        && node_data_group in image_info[node_image_type]) {

        var img = image_info[node_image_type][node_data_group]
        style_update = {};
        if (getStorageValue('node_render_type') == 'fit') {
          style_update['height'] = img.height;
          style_update['width'] = img.width;
        }

        style_update['background-image'] = img.src
        node.style(style_update);
      }
    }));
  }

  if (stateData.id in window.appdata['nodeData']) {
    await updateBackground(stateData);
  } else {
    window.appdata['nodeData'][stateData.id] = {}
    await buildAllNodes(stateData);
    await updateBackground(stateData);
  }
}
// Removes intermediate node and 
// adds edge between the nodes source and target node
const skipNode = (node) => {
  try {
    sources = node.incomers().sources();
    targets = node.outgoers().targets();

    //TODO: consider cy.move instead
    new_edges = [];
    for (i = 0; i < sources.size(); i++) {
      for (j = 0; j < targets.size(); j++) {
        sid = sources[i].data().id;
        tid = targets[j].data().id
        new_edges.push({
          'group': 'edges', 'data': {
            'id': "" + sid + "_" + tid,
            'source': sid,
            'target': tid
          }
        });
      }
    }
    cy.add(new_edges);
    node.remove();
  } catch (e) {
    console.log("Node skipping issues found for " + node + " ");
    console.log(e)
  }
}


const removeNonParams = () => {
  var vals = getStorageValue('nonParamNodeSelector').split(',');
  for (var i in vals){
    cy.nodes(vals[i]).forEach(function (node) { skipNode(node); });
  }
}


const restoreElements = async () => {
  cy.elements().remove();
  cy.add(cy.orig_elements);
}


const backupInitState = () => {
  cy.orig_elements = cy.elements().clone();
}

function updateRadioButtons(eleData, currVal) {
  for (let [elName, elValue] of Object.entries(eleData)) {
    if (currVal == elValue) {
      document.getElementById(elName).checked = true;
    }
  }
}

function playImages(comp,typ){
    let stateIds = getCurrentSessionData()['state_ids'];
    var totalImages = stateIds.length;
    let canvasId = 'playerCanvas';
    let canvas = document.getElementById('playerCanvas');
    let ctx = canvas.getContext('2d');
    let first = true;
    const imageList= [];
    let imagesReady = 0
    for (let stateId of stateIds){
         
        const image = new Image();
        var image_path = `${getStatePathFor(stateId)}/images/${comp}_${typ}__image.jpg`;
        imageList.push(image);
        function prepimage(){
          if (first){
                first=false;
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
            }
            imagesReady++;
         }
        image.onload = prepimage;
        image.src = image_path;
     }
    
    var intervalms = Math.round((5/totalImages)*1000);
    document.getElementById('stateValue').max = totalImages-1
    var loaded =false;
    function drawImages(canvasId){
        if (!loaded && imagesReady>=totalImages){
            loaded = true;
            if(document.getElementById("playValue").value === "true"){
                document.getElementById("playButton").innerHTML="Stop";
            }
            else{
                document.getElementById("playButton").innerHTML="Play";
            }
            
        } else {
            let currentIdx =document.getElementById('stateValue').value;
            let img = imageList[currentIdx];
            ctx.drawImage(img,0,0);
            ctx.fillText("State Id: " + stateIds[currentIdx], 5, 15); 
           if (document.getElementById('playValue').value === "true"){
                currentIdx++;
                currentIdx = currentIdx % totalImages;
            }
            document.getElementById('stateValue').value = currentIdx

        }
    }
    
    
    let intervalId = setInterval(function() {
                            drawImages(canvasId)},
                            intervalms);
    return intervalId

}

function loadPlayer(comp,typ){
    $('#playerModal').modal('show');
    $('#stateRange').value = 0
    document.getElementById("playButton").innerHTML="Loading";
    document.getElementById("playValue").value = false;
    let intervalId = playImages(comp,typ);
    $('#playerModal').on('hidden.bs.modal', function (e) {
        clearInterval(intervalId)  
    })
}

function updateSideBar() {
  /*
  on node click update node info
  */

  // var node_data = this.data()
  var node_id = getStorageValue('selected_node_id')
  var node_label = getStorageValue('selected_node_label')
  if (node_id == -1){
    return 
  }
  var node_info = getNodeData(node_id)
  var component_info = node_info.component_info;
  var html_list = [];
  html_list.push(`<div class="row"><div class="col">`)
  html_list.push(`<h3>Node: ${node_label}(${node_id})</h3>`);

  head_html = `
    <table class="table table-sm">
    <tr><td>Operation: ${node_label}</td></tr>
    <tr><td>Components: <a title="click to stat details for components" type="button" data-toggle="collapse" data-target=".table-stats" aria-expanded="false"><u>${Object.keys(component_info).join(", ")}</u></a> </td></tr>
    </table>`;
  html_list.push(head_html);

  html_list.push('</div></div>')
  html_list.push(`<div class="row"><div class="col">`)

  var actionList = []

  for (let comp in component_info) {

    let stats = component_info[comp]['value']['tensor__stats']
    let component_html = [`
    <h4>${comp}: ${component_info[comp].data_group_type}</h4>
    <table class="table table-sm collapse table-stats">
    <tr><td>Type: </td><td><b>${component_info[comp].data_group_type}</b></td></tr>
    <tr><td>Shape: </td><td> (${component_info[comp].shape})</td></tr>`];

    component_html.push(`<ul>`);
    for (const stat in stats) {
      if (stat != 'histogram') {
        component_html.push(`<tr><td>${stat}:</td><td>${stats[stat]}</td></tr>`);
      }
    }
    component_html.push("</table>")

    // html_list.push('</div></div>')
    // html_list.push(`<div class="row"><div class="col">`)
    html_list.push(component_html.join("\n"));

    var image_path = `${getStatePath()}/images/${comp}_tensor__image.jpg`
    
    html_list.push(`<div class="image_holder link_div" id="play_${comp}_tensor"> <img class="side_data" src="${image_path}"/><p class="image_caption">Heatmap</p></div>`);
      
    actionList.push(function () {  
            document.getElementById(`play_${comp}_tensor`).addEventListener("click", function() {
            loadPlayer(comp,"tensor");
        });
    }) 
// Disabled for now      
    if (node_label != 'INPUT')
      {
        var image_path = `${getStatePath()}/images/${comp}_first_delta__image.jpg`
        html_list.push(`<div class="image_holder link_div" id="play_${comp}_first_delta"><img class="side_data" src="${image_path}"/><p class="image_caption">Delta Heatmap (total change in parameters)</p></div>`);
        actionList.push(function () {  
            document.getElementById(`play_${comp}_first_delta`).addEventListener("click", function() {
            loadPlayer(comp,"first_delta");
        });
    }); 
      }
    html_list.push(`<div class="image_holder"><div id="${comp}Canvas1"></div><p class="image_caption">Histogram of current state</p></div>`);
    html_list.push(`<div class="image_holder"><div id="${comp}StatsOverSessionCanvas1"></div><p class="image_caption" >Mean/Variance across session</p></div>`);

    actionList.push(function () {
      var Width = 500;
      var Height = 400;
      let canvas = plotHist(comp, stats, Width, Height);
      document.getElementById(`${comp}Canvas1`).appendChild(canvas.node());
      let valueName = 'tensor__stats'
      let canvas2 = plotStatsOverTime(
        `${comp} - ${valueName}`,
        comp,
        valueName,
        window.appdata.stateData,
        getStorageValue('state_id'),
        Width,
        Height)
      document.getElementById(`${comp}StatsOverSessionCanvas1`).appendChild(canvas2.node());

    })

    // html_list.push('</div></div>')
    // html_list.push(`<div class="row"><div class="col">`)

    if (component_info[comp].data_group_type == 'PARAM') {
      let stats = component_info[comp]['value']['grad__stats']

      let component_html = [`
      <h4>${comp}: PARAM Gradient</h4>
      <table class="table table-sm collapse table-stats">
      <tr><td>Type: </td><td><b>PARAM Gradient</b></td></tr>
      <tr><td>Shape:</td><td> (${component_info[comp].shape})</td></tr>`];

      component_html.push(`<ul>`);
      for (const stat in stats) {
        if (stat != 'histogram') {
          component_html.push(`<tr><td>${stat}:</td><td>${stats[stat]}</td></tr>`);
        }
      }
      component_html.push("</table>")
      html_list.push(component_html.join("\n"));

      html_list.push('</div></div>')
      html_list.push(`<div class="row"><div class="col">`)

      var image_path = `${getStatePath()}/images/${comp}_grad__image.jpg`
      html_list.push(`<div class="image_holder link_div" id="play_${comp}_grad"><div><img  class="side_data" src="${image_path}"/></div><p class="image_caption">Heatmap</p></div>`);

        actionList.push(function () {  
            document.getElementById(`play_${comp}_grad`).addEventListener("click", function() {
            loadPlayer(comp,"grad");
        });
    }) 
      html_list.push(`<div class="image_holder"><div id="${comp}Canvas2"></div><p class="image_caption">Histogram of current state</p></div>`);
      html_list.push(`<div class="image_holder"><div id="${comp}StatsOverSessionCanvas2"></div><p class="image_caption">Mean/Variance across session</p></div>`);

      actionList.push(function () {
        var Width = 500;
        var Height = 400;
        let canvas = plotHist(comp, stats, Width, Height);
        document.getElementById(`${comp}Canvas2`).appendChild(canvas.node());
        let valueName = 'grad__stats'
        let canvas2 = plotStatsOverTime(
          `${comp} - ${valueName}`,
          comp,
          valueName,
          window.appdata.stateData,
          getStorageValue('state_id'),
          Width,
          Height)
        document.getElementById(`${comp}StatsOverSessionCanvas2`).appendChild(canvas2.node());
      })
    }
    html_list.push(`<hr/>`)
  }

  html_list.push('</div></div>')

  document.getElementById("node_info").innerHTML = html_list.join("");
  actionList.forEach(f => f())

}

// CREATE GRAPH
const initGraph = async () => {

  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),

    boxSelectionEnabled: false,
    autounselectify: true,


    style: cytoscape.stylesheet()
      .selector('node')
      .css({
        'background-fit': 'contain',
        'height': getStorageValue('cy-node-height'),
        'width': getStorageValue('cy-node-width'),
        'font-size': getStorageValue('cy-font-size'),
        'border-color': '#444',
        'border-width': 5,
        'border-opacity': 0.5,
        'color': '#333',
        'content': 'data(label)',
        'shape': 'square',
        'background-color': '#FFF',
      })
      .selector('.selected_node')
      .css({
        'border-width': 20,
        'border-color': "skyblue",
        'font-weight': 'bolder',
        

         'border-opacity': 1,
        // 'background-color': '#FFD',
      })
      .selector('edge')
      .css({
        "curve-style": "unbundled-bezier",
        "control-point-step-size": 0,
        'width': getStorageValue('cy-edge-size'),
        'target-arrow-shape': 'triangle',
        'opacity': 0.5,
        'line-color': '#666666',
        'target-arrow-color': '#555555'
      }),

    elements: getCurrentGraphData(),
    layout: getLayoutConfig('grid')
  });

  setTimeout(resize, 0);

  cy.ready(() => {
    changeStateByIdx(0);
    backupInitState();
    updateStyle();
    updateRadioButtons(imageTypeElData, getStorageValue('current_image_type'));
    updateRadioButtons(dataViewElData, getStorageValue('current_data_group').join("_"));
  });


  cy.on('click', 'node', function(evt){
    var node_data = this.data()
    cy.elements().removeClass("selected_node")
    this.addClass("selected_node")
    setStorageValue('selected_node_id',node_data.id)
    setStorageValue('selected_node_label',node_data.label)
    updateSideBar()
  });
  return cy;
}


const changeStateById = async (stateId) => {

  if (!(stateId in window.appdata['stateIdxLookup'])) {
    console.log("Invalid stateId " + stateId)
    return
  }
  else {
    return changeStateByIdx(window.appdata['stateIdxLookup'][stateId])
  }
}

function renderAdditionalInfo(){
  let addInfo = getCurrentState()['additional_info'];
  var html_list = [];

  if ( Object.keys(addInfo).length > 0){
   
    html_list.push(`<table class="table table-sm  table-stats">`)
    for (const [key, value] of Object.entries(addInfo)) {
      html_list.push(`<tr><td>${key}:</td><td>${value.value}</td></tr>`);
    }
    html_list.push("</table>")
  }
  document.getElementById("additional_info").innerHTML = html_list.join("\n");
}

const changeStateByIdx = async (stateIdx) => {
  let stateIds = getCurrentSessionData()['state_ids']
  if (stateIdx < 0 || stateIdx >= stateIds.length) {
    console.log("Invalid stateIdx " + stateIdx)
    return
  }
  let newStateId = stateIds[stateIdx]
  setStorageValue('state_id', newStateId);
  setStorageValue('state_idx', stateIdx)
  await renderNodeImages();
  window.updateGraphSelected(newStateId)
  document.getElementById("state_info").innerHTML = `State ID: ${newStateId}, Session ID: ${PARAMS.session_id}`
  renderAdditionalInfo()
}

const initSession = async () => {

  localStorage.clear();
  window.appdata = {}
  window.appdata['stateData'] = {}
  window.appdata['nodeData'] = {}
  window.appdata['metricIdxLookup'] = {}
  window.appdata['stateIdxLookup'] = {}

  // Load Session Data
  let sessionData = window.appdata['sessionData'] = await $.getJSON(`${getSessionPath()}/session.json`)
    .then(async function (sessionData) { return sessionData; });

  // Lookup maps
  sessionData.metric_ids.forEach(function (d, i) {
    window.appdata['metricIdxLookup'][d] = i
  })
  // state id to state idx
  sessionData.state_ids.forEach(function (d, i) {
    window.appdata['stateIdxLookup'][d] = i
  })

  // Load State Data
  let allStateData = await Promise.all(sessionData.state_ids
    .map(async function (state_id) {
      return $.getJSON(`${getSessionPath()}/${state_id}/state.json`)
    }));


  await buildHeadPlot(getCurrentSessionData(),"loss");

  allStateData.map(function (stateData) {
    window.appdata['stateData'][stateData.id] = stateData
  })



  await initGraph();

  // TEMPORARY FIX (TODO): this is currently used to ensure 
  //   the graph layout is formatted properly when the page is loaded.
  await sleep(1)
  await updateLayout("grid");
  await runPlot();
}

initSession()


//REGISTER FORM HANDLERS ----------------------------
document.getElementById("font_plus_btn").addEventListener("click", () => {
  current_font_size = getStorageValue('cy-font-size');
  new_font_size = parseInt(current_font_size) + 10;
  setScalarValue('cy-font-size', new_font_size);
  renderNodeImages();
});


document.getElementById("font_minus_btn").addEventListener("click", () => {
  current_font_size = getStorageValue('cy-font-size');
  new_font_size = parseInt(current_font_size) - 10;
  setScalarValue('cy-font-size', new_font_size);
  renderNodeImages();
});

document.getElementById("layout_btn_grid").addEventListener("click", () => {
  updateStyle();
  updateLayout('grid');

});
document.getElementById("layout_btn_dagre").addEventListener("click", () => {
  updateStyle();
  updateLayout('dagre');
});
document.getElementById("layout_btn_cose").addEventListener("click", () => {
  updateStyle();
  updateLayout('cose');
});

document.getElementById("default_view_btn").addEventListener("click", () => {
  cy.fit();
});

document.getElementById("reset_graph_btn").addEventListener("click", () => {
  setScalarValue('cy-font-size', getDefaultValue('cy-font-size'));
  restoreElements();
  renderNodeImages();
  updateStyle();
  updateLayout('grid');
});

document.getElementById("show_params_only_btn").addEventListener("click", () => {
  removeNonParams();
  updateStyle();
  refreshLayout();
});

// document.getElementById("node_size_fit_btn").addEventListener("click", () => {
//   setStorageValue('node_render_type', 'fit');
//   renderNodeImages();
//   updateStyle();
//   refreshLayout();
// });

// document.getElementById("node_size_fixed_btn").addEventListener("click", () => {
//   setStorageValue('node_render_type', 'fixed');
//   setStorageValue('cy-font-size', getDefaultValue('cy-font-size'));
//   renderNodeImages();
//   updateStyle();
//   refreshLayout();
// });


document.getElementById("hist_radio_btn").addEventListener("click", () => {
  setStorageValue('current_image_type', 'hist');
  renderNodeImages();
});


document.getElementById("session_stats_radio_btn").addEventListener("click", () => {
  setStorageValue('current_image_type', 'session_stats');
  renderNodeImages();
});

document.getElementById("view_param_btn").addEventListener("click", () => {
  setStorageValue('current_data_group', ['PARAM', 'tensor']);
  renderNodeImages();
});

document.getElementById("view_grad_btn").addEventListener("click", () => {
  setStorageValue('current_data_group', ['PARAM', 'grad']);
  renderNodeImages();
});

document.getElementById("view_buffer_btn").addEventListener("click", () => {
  setStorageValue('current_data_group', ['BUFFER', 'tensor']);
  renderNodeImages();
});


document.getElementById("next_state_btn").addEventListener("click", async () => {
  await changeStateByIdx(+getStorageValue('state_idx') + 1);
  updateSideBar();
});

document.getElementById("prev_state_btn").addEventListener("click", async () => {
  await changeStateByIdx(+getStorageValue('state_idx') - 1);
  updateSideBar();
});


document.getElementById("playButton").addEventListener("click", () => {
    var playing = document.getElementById("playValue").value === 'true';
    document.getElementById("playValue").value = !playing;
    playing = document.getElementById("playValue").value === 'true';
    if (playing){
        document.getElementById("playButton").innerHTML="Stop";

    }else{
        document.getElementById("playButton").innerHTML="Play";
    }

});
