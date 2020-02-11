//https://github.com/kaluginserg/cytoscape-node-html-label
//https://stackoverflow.com/questions/40261292/put-a-cytoscape-graph-inside-a-bootstrap-column

var win = $(window);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}  

win.resize(function() {
  resize();
});

function resize() {
  $("#cy-container").height(win.innerHeight() - 260);
  cy.resize();
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


//STORAGE HELPERS
var defaultScalars={
  'cy-layout':'grid',
  'cy-font-size':55,
  'cy-node-width':360,
  'cy-node-height':250,
  'cy-edge-size':10,
  'play_mode': 'stop',
  'active_image': 'tensor',
  'node_render_type': 'fixed',
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


function getSessionPath(){
  return `${getStorageValue('session_path')}/${getStorageValue('session_id')}`
}

function getStatePath(){
  return `${getSessionPath()}/${getStorageValue('state_id')}`;
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

async function updateLayout (name){
  layoutConfig = getLayoutConfig(name);
  layout = cy.layout(layoutConfig);
  // await sleep(20)
  layout.run();
  setScalarValue('current_layout_name',name);

}

function refreshLayout(){
  current_layout_name = getStorageValue('current_layout_name','grid');
  updateLayout(current_layout_name);

}

function getCurrentState(){
  return window.appdata.stateData[getStorageValue("state_id")];
}


function getCurrentGraphData(){
  return getCurrentState().graph;
}


function getCurrentSessionData(){

  return window.appdata.sessionData;
}


function getNodeData(node_id){
  return window.appdata.nodeData[getStorageValue("state_id")][node_id];
}

   
function updateStyle(){
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



async function renderNodeImages(){

  let stateData = getCurrentState()

  if (getStorageValue('node_render_type') == 'fixed'){
    //if fixed, use this
    updateStyle();

  }

  let current_image_type = getStorageValue('current_image_type');
  let current_data_group = getStorageValue('current_data_group');
  
  //TODO  switch toselector  https://js.cytoscape.org/#style/background-image


  function updateBackground(stateData){
    return Promise.all(cy.nodes().map(async function(node) {
      let ndata = node.data();
      if (!(ndata.id in window.appdata['nodeData'][stateData.id])){
        console.log(window.appdata['nodeData'][stateData.id].length)
        return
      }
      let nodeData = getNodeData(ndata.id);
      if (typeof(nodeData) == 'undefined') {
        //console.log(`nodeData was undefined for ${ndata.id} ${stateData.id}`)
        return
      }


      let image_info = getNodeData(ndata.id).image_info;
      let node_data_group = current_data_group
      let node_image_type = current_image_type

      if (ndata.label == 'INPUT'){
        node_image_type = 'heatmap'
        node_data_group = ['INPUT','tensor']
      }

      if (node_image_type in image_info 
        && node_data_group in image_info[node_image_type]) {

        var img = image_info[node_image_type][node_data_group] 
        style_update={};
        if (getStorageValue('node_render_type') == 'fit'){
          style_update['height'] = img.height;
          style_update['width'] = img.width;
        }
        style_update['background-image'] =  img.src//plotNormDist(-0.1,1.3,.2,0.1)//build_random_svg()//img.src;
        node.style(style_update);}
    }));
  }
  
  if (stateData.id in window.appdata['nodeData'] ){
    await updateBackground(stateData);
  } else{
    window.appdata['nodeData'][stateData.id] = {}
    await buildAllNodes(stateData);
    await updateBackground(stateData);
  }

  // cy.style().selector('node').css({
  //   'font-size': getStorageValue('cy-font-size'),
  // }).update();
}

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
    console.log("Node skipping issues found for " + node +" ");
    console.log(e)
  }
}


const removeNoneParams = () => { 
  cy.nodes('node[label="Relu"]').forEach(function (node) { skipNode(node); });
  cy.nodes('node[label="Add"]').forEach(function (node) { skipNode(node); });
  cy.nodes('node[label="MaxPool"]').forEach(function (node) { skipNode(node); });
  cy.nodes('node[label="GlobalAveragePool"]').forEach(function (node) { skipNode(node); });
  cy.nodes('node[label="Flatten"]').forEach(function (node) { skipNode(node); });
}


const restoreElements = async () => {
  cy.elements().remove(); 
  cy.add( cy.orig_elements );
}




const backupInitState = () => {
  cy.orig_elements = cy.elements().clone();  
}

function updateRadioButtons(eleData, currVal){
  for (let [elName, elValue] of Object.entries(eleData)) {
    if (currVal == elValue){
      document.getElementById(elName).checked = true;
    }
  }
}


//https://stackoverflow.com/questions/39695967/d3-js-ordinal-scale-version-3-to-version-4
const buildHeadPlot = async () => {

  var chartDiv = document.getElementById("session_loss_plot");
  // Extract the width and height that was computed by CSS.
  var cwidth = chartDiv.clientWidth;
  var cheight = chartDiv.clientHeight;
  
  
  // set the dimensions and margins of the graph
  var margin = {top: 20, right: 20, bottom: 50, left: 50},
  width = cwidth - margin.left - margin.right,
  height = cheight - margin.top - margin.bottom;
  var active_metric = "loss";
  var padding = 1
  // set the ranges
  var xScale = d3.scaleBand().padding([padding]).rangeRound([0, width])
  var yScale = d3.scaleLinear().range([height, 0]);
    
  var svg = d3.select("#session_loss_plot").append("svg")
  .attr("width", cwidth)
  .attr("height", cheight)
  .append("g")
  .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");
  
  // Get the data
  data = getCurrentSessionData();
  state_ids = data.state_ids
  metric_ids = data.state_ids
  all_metrics = state_ids.map((id)=>data.session_metrics[id])
  state_metrics = state_ids.map((id)=>data.session_metrics[id])
  
  xScale.domain(metric_ids);
  yScale.domain([0, d3.max(all_metrics, function(d) { 
    return d.metrics[active_metric]; })]);

  let xAxisGen = d3.axisBottom(xScale);
  
  let tickGap = metric_ids.length/10

  let xticks = metric_ids.filter((v,i)=>(i%tickGap)==0)
  xAxisGen.tickValues(xticks)
  xAxisGen.tickFormat((d,i) => xticks[i]);

  // define the line
  var valueline = d3.line()
  .x(function(d) { 
    val = xScale(d.id)
    return val; })
  .y(function(d) { 
    return yScale(d.metrics[active_metric]); });

  // Add the valueline path.
  svg.append("path")
    .data([all_metrics])
    .attr("class", "line")
    //.attr("transform", "translate(0,0)")
    .attr("d", valueline);

  // Add the X Axis
  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxisGen)    


var radius = 5;
svg.selectAll(".dot")
    .data(state_metrics)
  .enter().append("circle") // Uses the enter().append() method
    .attr("class", "dot") // Assign a class for styling
    .attr("cx", function(d, i) { return xScale(d.id) })
    .attr("cy", function(d) { return yScale(d.metrics[active_metric]) })
    .attr("r", radius)
    .on("mouseover", async function(d){
      svg.selectAll(".dot").attr("r",radius).attr("class", "dot");
      d3.select(this).attr('r',radius *2).attr("class", "dot dot_selected");
      setStorageValue('state_id',d.id);
      await renderNodeImages();
      document.getElementById("state_info").innerHTML = `<p>state id: ${d.id}</p>`
      });

  // text label for the x axis
  svg.append("text")             
  .attr("transform",
        "translate(" + (width/2) + " ," + 
                        (height + margin.top + 20) + ")")
  .style("text-anchor", "middle")
  .text("epoch_iteration (state id)");

  // text label for the y axis
  svg.append("text")
  .attr("transform", "rotate(-90)")
  .attr("y", 0 - margin.left)
  .attr("x",0 - (height / 2))
  .attr("dy", "1em")
  .style("text-anchor", "middle")
  .text(active_metric);      

  // Add the Y Axis
  svg.append("g")
    .call(d3.axisLeft(yScale));

  }    
  
  // CREATE GRAPH
  
  const initGraph = async ()=> {

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
  
      elements: getCurrentGraphData(),
      layout: getLayoutConfig('grid')
    });
  
    setTimeout(resize, 0);
  
  cy.ready( ()=> {
    backupInitState();    
    renderNodeImages();
    updateStyle();
    updateRadioButtons(imageTypeElData,getStorageValue('current_image_type'));
    updateRadioButtons(dataViewElData,getStorageValue('current_data_group').join("_"));
  });
  
  
  cy.on('click', 'node', function(evt) {
    /*
    on node click update node info
    */
  
    var node_data = this.data()
    var node_info = getNodeData(node_data.id)
    var component_info = node_info.component_info;
    var image_info = node_info.image_info;
    html_list = [];
  
    head_html = `
    <table class="table table-sm">
    <tr><td>Node ID: ${node_data.id}</td></tr>
    <tr><td>Operation: ${node_data.label}</td></tr>
    </table>
    `;
    html_list.push(head_html);
  
    for (let [image_type, image_data] of Object.entries(image_info)) {
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
    //html_list.push(JSON.stringify(this.data(), undefined, 2))
    document.getElementById("node_info").innerHTML = html_list.join("");
    
  });
  return cy;
}
  

const loadImage = (img) =>
  new Promise(resolve => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
  });


function makeImage(src){
  let img = new Image();
  img.src = src;
  return img;
}


const buildNodeInfo = async (node,state) =>{
  let promise_list = [];
  let ndata = node.data
  let component_ids = ndata.component_ids;

  
  var image_info ={}
  var stats_info ={}
  getStorageValue('image_types').forEach(
    function(img_type){
      image_info[img_type]={}});
      var component_info = {};
      var dgts_avail = new Set();
      for (i=0;i<component_ids.length;i++){
        if (component_ids[i] in state['data']) {
          comp = component_ids[i];
          component_info[comp] = state['data'][comp];
          dgt = component_info[comp]['data_group_type']
          dgts_avail.add(dgt)
          if (!(dgt in stats_info)){
            stats_info[dgt]=[]
          }
          stat_info={
            data_group_type:dgt,
            component:comp,
            tensor__stats:state['data'][comp]['value']['tensor__stats']}
          if (dgt =='PARAM'){
            stat_info['grad_stat'] = state['data'][comp]['value']['grad__stats']
          }
          stats_info[dgt].push(stat_info)
        }
  }

    getStorageValue('valid_data_group_types').forEach(function(item,index){
      let dgt = item[0]
      let vt = item[1]
      if (dgts_avail.has(dgt)){
        getStorageValue('image_types').forEach(function(image_type,index2){
          if (image_type == 'dist'){
            var stat_info = stats_info[dgt]
            var plot_stats = []
            for (i =0; i< stat_info.length;i++){
              plot_stat = {...stat_info[i].tensor__stats}
              plot_stat['xlabel'] = stat_info[i].component;
              plot_stats.push(plot_stat)
            }
            
            image_info[image_type][[dgt,vt]] = { 
              src:plotNormDistMulti(plot_stats),
              height: getStorageValue('cy-node-height'),
              width: getStorageValue('cy-node-width')}
          } else{
            var image_path = `${getSessionPath()}/${state.id}/images/${ndata.id}_${dgt}_${vt}__${image_type}.jpg`
            var img = makeImage(image_path)

            image_info[image_type][[dgt,vt]] = img  
            promise_list.push(loadImage(img))

          }

        });
      }
  
    });


  //Gather results before proceeding to update global data
  var results = await Promise.all(promise_list)

  // //ASSIGN TO NODE DATA OBJECT
  window.appdata['nodeData'][state.id][ndata.id]={
    'component_info': component_info,
    'image_info': image_info}

  return results
}
  

const buildAllNodes = async (stateData) =>{
    await Promise.all(stateData.graph.nodes.map(
    async function(node){
      return await buildNodeInfo(node,stateData)
    }));
}

const initSession = async () => {

  localStorage.clear();
  window.appdata = {}
  window.appdata['stateData'] = {}
  window.appdata['nodeData'] = {}

  // Load Session Data
  let sessionData = window.appdata['sessionData'] = await $.getJSON(`${getSessionPath()}/session.json`).
  then(async function(sessionData){return sessionData;});

  // Load State Data
  let allStateData = await Promise.all(sessionData.state_ids
  .map(async function(state_id){
    return $.getJSON(`${getSessionPath()}/${state_id}/state.json`)}));


  await buildHeadPlot();

  allStateData.map(function(stateData){
    window.appdata['stateData'][stateData.id] = stateData
  })

  // Prep states and load images
  // await Promise.all(allStateData.map(async function(stateData){
  //   window.appdata['stateData'][stateData.id] = stateData
  //   window.appdata['nodeData'][stateData.id] = {}
  //   return await buildAllNodes(stateData);
  // }))


  await initGraph()

  // TEMPORARY FIX (TODO): this is currently used to ensure 
  //   the graph layout is formatted properly when the page is loaded.
  await sleep(1)
  await updateLayout("grid");

}
  
initSession()


//REGISTER FORM HANDLERS ----------------------------
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
  updateStyle();
  updateLayout('grid');

});
document.getElementById("layout_btn_dagre").addEventListener("click",() =>{
  updateStyle();
  updateLayout('dagre');
});
document.getElementById("layout_btn_cose").addEventListener("click",() =>{
  updateStyle();
  updateLayout('cose');
});

document.getElementById("default_view_btn").addEventListener("click",() =>{
  cy.fit();
});

document.getElementById("reset_graph_btn").addEventListener("click",() =>{
  setScalarValue('cy-font-size',getDefaultValue('cy-font-size'));
  restoreElements();
  renderNodeImages();
  updateStyle();
  updateLayout('grid');
    
});

document.getElementById("show_params_only_btn").addEventListener("click",() =>{
  removeNoneParams();
  updateStyle();
  refreshLayout();
});


document.getElementById("node_size_fit_btn").addEventListener("click",() =>{
  setStorageValue('node_render_type','fit');
  renderNodeImages();
  updateStyle();
  refreshLayout();
});

document.getElementById("node_size_fixed_btn").addEventListener("click",() =>{
  setStorageValue('node_render_type','fixed');
  setStorageValue('cy-font-size',getDefaultValue('cy-font-size'));
  renderNodeImages();
  updateStyle();
  refreshLayout();
});

document.getElementById("heatmap_radio_btn").addEventListener("click",() =>{
  setStorageValue('current_image_type','heatmap');
  renderNodeImages();
});

document.getElementById("dist_radio_btn").addEventListener("click",() =>{
  setStorageValue('current_image_type','dist');
  renderNodeImages();
});

document.getElementById("view_param_btn").addEventListener("click",() =>{
  setStorageValue('current_data_group',['PARAM','tensor']);
  renderNodeImages();
});


document.getElementById("view_grad_btn").addEventListener("click",() =>{
  setStorageValue('current_data_group',['PARAM','grad']);
  renderNodeImages();
});

document.getElementById("view_buffer_btn").addEventListener("click",() =>{
  setStorageValue('current_data_group',['BUFFER','tensor']);
  renderNodeImages();
});


// document.getElementById("step_forward_btn").addEventListener("click",async () =>{
//   setStorageValue('current_state_idx',0);
  
// });

document.getElementById("play_forward_btn").addEventListener("click",async () =>{
  setStorageValue('play_mode',"play_forward");

  var sessionData = getCurrentSessionData();
  var done = false;
  while (!done){
    for (i in sessionData.state_ids){
      let play_mode = getStorageValue('play_mode');
      state_id = sessionData.state_ids[i]
      setStorageValue('state_id',state_id);
          
      await renderNodeImages();
      document.getElementById("state_info").innerHTML = `<p>state id: ${state_id}</p>`
      if (play_mode != "play_forward"){
        done = true
        break
      }
      await sleep(30)
    }
    
  }
  
});


document.getElementById("stop_btn").addEventListener("click",async () =>{
  setStorageValue('play_mode',"stop");  
});

//PLOTTING FUNCTIONS 

function plotNormDistMulti( 
  statsList,
  dotsCount = 50, 
  Width=300, 
  Height=200, 
  margin = {top: 20, right: 20, bottom: 30, left: 40}){

  const canvas = d3.select(document.createElement( 'canvas' ) ).attr("width", Width).attr("height", Height);
  var ctx = canvas.node().getContext('2d')

  var plotHeight = Height /statsList.length

  for (i = 0;i< statsList.length;i++){
    var stat = statsList[i]

  plotNormDistAsCanvas(
    stat.xlabel,
    stat.min,
    stat.max,
    stat.mean, 
    stat.variance,
    ctx,  
    dotsCount = dotsCount, 
    Width=Width, 
    Height=plotHeight, 
    xoffset = 0,
    yoffset = i * plotHeight,
    margin = margin)
  }
  return canvas.node().toDataURL();
}


function plotNormDistAsCanvas( 
  xlabel,
  minval,
  maxval,
  mean ,
  sigma , 
  context,
  dotsCount = 20, 
  Width=300, 
  Height=200, 
  xoffset = 0,
  yoffset = 0,
  margin = {top: 20, right: 20, bottom: 30, left: 40}){

 
  const width = Width - margin.right - margin.left;
  const height= Height - margin.top - margin.bottom;
  context.translate(margin.left, margin.top);
  context.font = "8px monospace";
  context.fillStyle = 'black'

  if ((maxval - minval) == 0){
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(`${xlabel}`, width/2, height + yoffset);
    context.fillText(`Stats: mean:${mean}, var:${sigma}, min/max: ${minval}/${maxval}`, width/2, height + yoffset+10);
    context.closePath();
    context.translate(-margin.left, -margin.top);
    return 
  }

  const xScale = d3.scaleLinear().rangeRound([xoffset, width+xoffset]);
  const yScale = d3.scaleLinear().rangeRound([height+yoffset, yoffset]);
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(  yScale);

  function drawXAxis() {
    var tickCount = 10,
        tickSize = 6,
        ticks = xScale.ticks(tickCount),
        tickFormat = xScale.tickFormat();
  
    context.beginPath();

  
    context.beginPath();
    context.moveTo(0, height+yoffset);
    context.lineTo(width+tickSize, height+yoffset);
    context.strokeStyle = "#BBB";
    context.stroke();


    ticks.forEach(function(d) {
      context.moveTo(xScale(d), height+yoffset);
      context.lineTo(xScale(d), height + tickSize+yoffset);
    });
    context.strokeStyle = "#BBB";
    context.stroke();
    context.closePath()
  
    context.textAlign = "center";
    context.textBaseline = "top";
    ticks.forEach(function(d) {
      context.fillText(tickFormat(d), xScale(d), height + tickSize+yoffset);
    });
    context.fillText(xlabel, width/2, height + tickSize+yoffset+10);
    

    
  }


  function drawYAxis() {
    var tickCount = 5,
        tickSize = 6,
        tickPadding = 3,
        ticks = yScale.ticks(tickCount),
        tickFormat = yScale.tickFormat(tickCount);

    context.beginPath();
    ticks.forEach(function(d) {
      context.moveTo(0, yScale(d));
      context.lineTo(-6, yScale(d));
    });
    context.strokeStyle = "#BBB";
    context.stroke();
  
    context.beginPath();
    context.moveTo(-tickSize, 0+yoffset);
    context.lineTo(0.5, 0+yoffset);
    context.lineTo(0.5, height+yoffset);
    context.lineTo(-tickSize, height+yoffset);
    context.strokeStyle = "#BBB";
    context.stroke();
  
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.closePath()
    // ticks.forEach(function(d) {
    //   context.fillText(tickFormat(d), -tickSize - tickPadding, yScale(d));
    // });
  }



  const line = d3.line()
  .curve(d3.curveLinear)
  .x(d => xScale(d[0]))
  .y(d => yScale(d[1]))
  .context(context);


  var interval = (maxval - minval)/dotsCount
  var data = []

  for(var x = minval; x<=maxval;x = x + interval){
    var y = Math.exp(-0.5 * Math.pow(((x - mean)/sigma),2))/(sigma * Math.sqrt(2 * Math.PI))
    var entry = [x,y]
    data.push(entry)
  }
  
  const xExtent = d3.extent(data, d => d[0]);
  const yExtent = d3.extent(data, d => d[1]);
  xScale.domain(xExtent);
  yScale.domain(yExtent);

  //context.clearRect(0, 0, width, height);
  context.beginPath();
  line(data);
  context.lineWidth = 1;
  context.opacity = 0.7;
  context.strokeStyle = "steelblue";
  context.stroke();
  context.closePath();

  drawXAxis()
  drawYAxis()
  context.translate(-margin.left, -margin.top);

}

