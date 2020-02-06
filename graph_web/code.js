//https://github.com/kaluginserg/cytoscape-node-html-label
//https://stackoverflow.com/questions/40261292/put-a-cytoscape-graph-inside-a-bootstrap-column

var win = $(window);

win.resize(function() {
  resize();
});

function resize() {
  // console.log(win.height(), win.innerHeight());
  $("#cy-container").height(win.innerHeight() - 130);
  cy.resize();
}

setTimeout(resize, 0);

var nodeOptions = {
  normal: {
    bgColor: 'grey'
  },
  selected: {
    bgColor: 'yellow'
  }
};

var edgeOptions = {
  selected: {
    lineColor: 'yellow'
  }
};


//STORAGE HELPERS
var defaultScalars={
  'cy-layout':'grid',
  'cy-font-size':55,
  'cy-node-width':300,
  'cy-node-height':300,
  'cy-edge-size':10,
  'active_image': 'tensor',
  'node_render_type': 'fit',
  'session_path' :"session_data",
  'session_id': "test",
  'state_id' :"0_0",
  'current_image_type':'dist',
  'nonParamNodeSelector': 'node[label="Add"],node[label="Flatten"],node[label="MaxPool"],node[label="Relu"]'
}

var defaultJSON={
  'image_types' :['heatmap','dist'],
  'valid_data_group_types' :[['PARAM','tensor'],['PARAM','grad'],['BUFFER','tensor'],['INPUT','tensor'],['OUTPUT','tensor']],
  'current_data_group':['PARAM','tensor']
}

function isJSONValue(key){
  return (key in defaultJSON);
}

function setScalarValue(key, value){
  localStorage.setItem(key,value);
  return value;
}

//get/set SCALAR
function getScalarValue(key,defaultValue = null){
  //(key)
  if (defaultValue == null){
    defaultValue = defaultScalars[key];
  }
  storageValue = localStorage.getItem(key)
  if (storageValue) {
    return storageValue;
  }
  else {
    return setScalarValue(key,defaultValue)
  }
}




function setJSONValue(key, value){
  localStorage.setItem(key,JSON.stringify(value));
  return value;
}
//get/set JSON
function getJSONValue(key,defaultValue = null){
  if (defaultValue == null){
    defaultValue = defaultJSON[key];
  }
  var storageValue = localStorage.getItem(key)
  if (storageValue) {
    return JSON.parse(storageValue)
  }
  else {
    return setJSONValue(key,defaultValue)
  }
}



// get/set storage (USE THIS)
function getStorageValue(key,defaultValue = null){

  if (isJSONValue(key)){
    return getJSONValue(key,defaultValue)
  }
  else{
    return getScalarValue(key,defaultValue)
  }
}


function setStorageValue(key, value){
  if (isJSONValue(key)){
    return setJSONValue(key,value)
  }
  else{
    return setScalarValue(key,value)
  }
}

function getDefaultValue(key){
  if (isJSONValue(key)) {
    return defaultJSON[key];
  }
  else{
    return defaultScalars[key];
  }
}



function getStatePath(){
  return `${getStorageValue('session_path')}/${getStorageValue('session_id')}/${getStorageValue('state_id')}`;

}

//LAYOUT HELPERS
function getLayoutConfig(name) {
  return {
    name: name,//grid?, dagre
    animate: false,
    directed: true,
   // padding: 50,
    // marginy:'500',
    fit: true,
    // nodeOverlap: 2,
    spacingFactor: 1.2,
    // name: 'cola',
    // }
  };
}

const updateLayout = async (name) => {
  layoutConfig = getLayoutConfig(name);
  layout = cy.layout(layoutConfig);
  layout.run();
  setScalarValue('current_layout_name',name);

}

const refreshLayout = async => {
  current_layout_name = getStorageValue('current_layout_name','grid');
  updateLayout(current_layout_name);

}


// CREATE GRAPH

const initGraph = ()=> {
  localStorage.clear();

  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),

    boxSelectionEnabled: false,
    autounselectify: true,

    style: cytoscape.stylesheet()
      .selector('node')
      .css({
        'background-fit': 'cover',
        'height': getStorageValue('cy-node-height'),
        'width': getStorageValue('cy-node-width'),
        'font-size': getStorageValue('cy-font-size'),
        'border-color': '#000',
        'border-width': 5,
        'border-opacity': 0.5,
        'content': 'data(label)',
        'shape': 'square',
        'font-size': getStorageValue('cy-font-size'),
        'background-color': '#DDD',
      })
      .selector('edge')
      .css({
        'curve-style': 'bezier',
        // "control-point-distances": [40, -40],
        // "control-point-weights": [0.250, 0.75],
        'width': getStorageValue('cy-edge-size'),
        'target-arrow-shape': 'triangle',
        'opacity': 0.5,
        'line-color': '#666666',
        'target-arrow-color': '#555555'
      }),

    elements: $.getJSON(`${getStatePath()}/graph.json`),
    layout: getLayoutConfig('grid')
  });
  return cy;
}

initGraph();



const renderNodeImages = async () => {


  if (getStorageValue('node_render_type','fit') == 'fixed'){
    //if fixed, use this
    cy.style().selector('node').css({
      'height': getStorageValue('cy-node-height'),
      'width': getStorageValue('cy-node-width'),
      'font-size': getStorageValue('cy-font-size'),
      'background-fit':'cover'
    }).update();
  }

  cy.style().selector('node').css({
    'font-size': getStorageValue('cy-font-size'),
  }).update();

  var current_image_type = getStorageValue('current_image_type');
  var current_data_group = getStorageValue('current_data_group');
  

  var updated_stuff = await Promise.all(cy.nodes().map(function(node) {
    ndata = node.data();
    if (current_image_type in ndata.image_info && current_data_group in ndata.image_info[current_image_type]) {

      var img = ndata.image_info[current_image_type][current_data_group]
      style_update={};
      style_update['height'] = img.height;
      style_update['width'] = img.width;
      style_update['background-image'] = img.src;
      node.style(style_update);
    }
  }));


  return updated_stuff;
}
    
const updateStyle = async () => {

  cy.style()
  .selector('node')
  .css({
    'height': getStorageValue('cy-node-height'),
    'width': getStorageValue('cy-node-width'),
    'font-size': getStorageValue('cy-font-size'),
    'content': 'data(label)',
    'shape': 'square',
  })
  .selector(getStorageValue('nonParamNodeSelector'))
  .css({
    'height': 200,
    'width': 200,
    'shape': 'diamond',
  }).update();

  cy.nodes().leaves().style({ 
    'border-width': 20,
    'border-color': '#F00' });
  cy.nodes().roots().style({
    'border-width': 20,
     'border-color': '#0F0' });
}

const skipNode = async (node) => {
  try {
    sources = node.incomers().sources();
    targets = node.outgoers().targets();

    // console.log(targets.size());

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
    console.log(node);
  }
}


const removeNoneParams = async () => { 
  cy.nodes('node[label="Relu"]').forEach(function (node) { skipNode(node); });
  cy.nodes('node[label="Add"]').forEach(function (node) { skipNode(node); });
  cy.nodes('node[label="MaxPool"]').forEach(function (node) { skipNode(node); });
  cy.nodes('node[label="GlobalAveragePool"]').forEach(function (node) { skipNode(node); });
  cy.nodes('node[label="Flatten"]').forEach(function (node) { skipNode(node); });
}


const restoreElements = async () => {
  cy.elements().remove(); cy.add( cy.orig_elements );
}

const loadImage = img =>
    new Promise(resolve => {
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
    });

function makeImage(src){
  img = new Image();
  img.src = src;
  return img;
}


const updateNodeInfo = async (node,state) =>{

  promise_list = [];
  ndata = node.data()
  component_ids = ndata.component_ids;

  var image_info ={}
  getStorageValue('image_types').forEach(function(img_type){image_info[img_type]={}});
  var component_info = {};
  var dgts_avail = new Set();
  for (i=0;i<component_ids.length;i++){
    if (component_ids[i] in state['data']) {
      comp = component_ids[i];
      component_info[comp] = state['data'][comp];
      dgts_avail.add(component_info[comp]['data_group_type'])

    }
  }
  
  getStorageValue('valid_data_group_types').forEach(function(item,index){
    dgt = item[0]
    vt = item[1]
    if (dgts_avail.has(dgt)){
      getStorageValue('image_types').forEach(function(image_type,index2){
        var image_path = `${getStatePath()}/images/${ndata.id}_${dgt}_${vt}__${image_type}.jpg`
        var img = makeImage(image_path)
        image_info[image_type][[dgt,vt]] = img
        promise_list.push(loadImage(img))
      });
    }

  });
  node.data('component_info',component_info);
  node.data('image_info',image_info);
  return await Promise.all(promise_list);
}

const loadState = async () => {
  var state = await $.getJSON(`${getStatePath()}/state.json`)
  return await Promise.all(cy.nodes().map(function(node){
    return updateNodeInfo(node,state);  
  }));

}


const backupInitState = async () => {
  cy.orig_elements = cy.elements().clone();  
}

function updateRadioButtons(eleData, currVal){
  for (let [elName, elValue] of Object.entries(eleData)) {
    if (currVal == elValue){
      document.getElementById(elName).checked = true;
    }
  }
}


var dataViewElData = {
  view_buffer_btn: 'BUFFER_tensor',
  view_grad_btn: 'PARAM_grad',
  view_param_btn: 'PARAM_tensor'
}

var imageTypeElData = {
  dist_radio_btn: 'dist',
  heatmap_radio_btn: 'heatmap'
}



cy.ready(() => {

  loadState().then
  (function(){backupInitState();}).then
  (function(){renderNodeImages()}).then
  (function(){updateStyle()}).then
  (function(){updateLayout("grid")});
  updateRadioButtons(imageTypeElData,getStorageValue('current_image_type'));
  updateRadioButtons(dataViewElData,getStorageValue('current_data_group').join("_"));

});


// EVENT LISTENERS ------------------------------------------------------------------

cy.on('click', 'node', function(evt) {

  node_data = this.data()
  component_info = this.data().component_info;
  html_list = [];

  head_html = `
  <table class="table table-sm">
  <tr><td>Node ID: ${node_data.id}</td></tr>
  <tr><td>Operation: ${node_data.label}</td></tr>
  </table>
  `;
  html_list.push(head_html);

  for (let [image_type, image_data] of Object.entries(node_data.image_info)) {
    for (let [value_type, img] of Object.entries(image_data)) {
      html_list.push(`<div class="img-holder"> <img src="${img.src}"/></div>`);

    }
  } 

  html_list.push('<hr/>');
  html_list.push('<h6>Components</h6>');
  
  for (var comp in component_info){
    component_html = `
    <table class="table table-sm">
    <tr><td>Name: ${comp}</td></tr>
    <tr><td>Type: ${component_info[comp].data_group_type}</td></tr>
    <tr><td>Shape: (${component_info[comp].shape})</td></tr>
    `;    
 
    component_html += "</table>"
    html_list.push(component_html);

  }
  
  html_list.push('<br/>')
  html_list.push(JSON.stringify(this.data(), undefined, 2))
  document.getElementById("node_info").innerHTML = html_list.join("");

  
});



  document.getElementById("font_plus_btn").addEventListener("click",() =>{
    current_font_size = getStorageValue('cy-font-size');
    new_font_size = parseInt(current_font_size) + 10;
    setScalarValue('cy-font-size',new_font_size);
    renderNodeImages();
  });


  document.getElementById("font_minus_btn").addEventListener("click",() =>{
    current_font_size = getStorageValue('cy-font-size');
    new_font_size = parseInt(current_font_size) - 10;
    setScalarValue('cy-font-size',new_font_size);
    renderNodeImages();
});

document.getElementById("layout_btn_grid").addEventListener("click",() =>{
  updateStyle().then(function(){updateLayout('grid')})

});
document.getElementById("layout_btn_dagre").addEventListener("click",() =>{
  updateStyle().then(function(){updateLayout('dagre')})
});
document.getElementById("layout_btn_cose").addEventListener("click",() =>{
  updateStyle().then(function(){updateLayout('cose')});
});



document.getElementById("default_view_btn").addEventListener("click",() =>{
  cy.fit();
});

document.getElementById("reset_graph_btn").addEventListener("click",() =>{
  setScalarValue('cy-font-size',getDefaultValue('cy-font-size'));
  restoreElements().
  then(function(){renderNodeImages();}).
  then(function(){updateStyle();}).
  then(function(){updateLayout('grid');})
      

});

document.getElementById("show_params_only_btn").addEventListener("click",() =>{
  removeNoneParams()
  .then(updateStyle)
  .then(refreshLayout);
});


document.getElementById("node_size_fit_btn").addEventListener("click",() =>{
  setStorageValue('node_render_type','fit');
  renderNodeImages().
  then(updateStyle).
  then(refreshLayout);
});

document.getElementById("node_size_fixed_btn").addEventListener("click",() =>{
  setStorageValue('node_render_type','fixed');
  setStorageValue('cy-font-size',getDefaultValue('cy-font-size'));
  renderNodeImages().then(updateStyle).then(refreshLayout);
});

document.getElementById("heatmap_radio_btn").addEventListener("click",() =>{
  setStorageValue('current_image_type','heatmap');
  renderNodeImages();
});

document.getElementById("dist_radio_btn").addEventListener("click",() =>{
  setStorageValue('current_image_type','dist');
  renderNodeImages()
});



document.getElementById("view_param_btn").addEventListener("click",() =>{
  setStorageValue('current_data_group',['PARAM','tensor']);
  //renderNodeImages().then(updateStyle).then(refreshLayout);
  renderNodeImages();
});


document.getElementById("view_grad_btn").addEventListener("click",() =>{
  setStorageValue('current_data_group',['PARAM','grad']);
  //renderNodeImages().then(updateStyle).then(refreshLayout);
  loadState().then(function(){renderNodeImages()})
});

document.getElementById("view_buffer_btn").addEventListener("click",() =>{
  setStorageValue('current_data_group',['BUFFER','tensor']);
  //renderNodeImages().then(updateStyle).then(refreshLayout);
  loadState().then(function(){renderNodeImages()})
});

document.getElementById("state_id_btn").addEventListener("click",() =>{


  setStorageValue('state_id',document.getElementById('state_id_input').value);
  loadState().then(function(){renderNodeImages()})
  
//  renderNodeImages().then(updateStyle).then(refreshLayout);
});
