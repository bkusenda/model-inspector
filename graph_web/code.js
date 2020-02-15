//https://github.com/kaluginserg/cytoscape-node-html-label
//https://stackoverflow.com/questions/40261292/put-a-cytoscape-graph-inside-a-bootstrap-column

/**
 * https://gomakethings.com/getting-all-query-string-values-from-a-url-with-vanilla-js/
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
  //dist_radio_btn: 'dist',
  hist_radio_btn: 'hist',
  session_stats_radio_btn: 'session_stats'
}

//STORAGE HELPERS
var defaultScalars={
  'cy-layout':'grid',
  'cy-font-size':50,
  'cy-node-width':460,
  'cy-node-height':460,
  'cy-edge-size':10,
  'play_mode': 'stop',
  'active_image': 'tensor',
  'node_render_type': 'fixed',
  'session_path' :"session_data",
  'session_id': PARAMS.session_id,
  'state_id' :"0_0",
  'current_image_type':'session_stats',
  'nonParamNodeSelector': 'node[label="Add"],node[label="Flatten"],node[label="MaxPool"],node[label="Relu"]'
}

var defaultJSON={
  'image_types' :['hist','session_stats'],
  'valid_data_group_types' :[['PARAM','tensor'],['PARAM','grad'],['BUFFER','tensor'],['INPUT','tensor'],['OUTPUT','tensor'],['PARAM','first_delta']],
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
    name: name,
    animate: false,
    directed: true,
    fit: true,
    spacingFactor: 1.2,
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
    'content': function(n){
      var data = n.data()
      return `${data.label}(${data.id})`},
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

//Preloading so we can get images sizes before rendering graph as well as cache node images
const buildNodeInfo = async (node,state) =>{
  let promise_list = [];
  let ndata = node.data
  let component_ids = ndata.component_ids;
  
  var image_info ={}
  var stats_info ={}
  var component_info = {};
  var dgt_data = {}

  //Gather info on components
  getStorageValue('image_types').forEach(
    function(img_type){
      image_info[img_type]={};
    });

  for (i=0;i<component_ids.length;i++){
    if (component_ids[i] in state['data']) {
      comp = component_ids[i];
      comp_data = state['data'][comp];
      component_info[comp] = comp_data;
      dgt = comp_data['data_group_type']
      if (!(dgt in dgt_data)){
        dgt_data[dgt]=[];
      }
      dgt_data[dgt].push(comp_data)
    }
  }

  //CREATES/LOAD NODE IMAGES
  getStorageValue('valid_data_group_types').forEach(function(item,index){
    let dgt = item[0]
    let vt = item[1]
    if (dgt in dgt_data){
      var compList = dgt_data[dgt]
      //GEN GRAPHS
      getStorageValue('image_types').forEach(function(image_type,index2){
        let statsList = []

        compList.forEach(function(comp){
          let stat_info={
            data_group_type:comp['data_group_type'],
            component:comp.id,
            stats:comp['value'][`${vt}__stats`]};

          // if (comp['data_group_type'] =='PARAM'){
          //   stat_info['grad_stat'] = comp['value']['grad__stats']
          // }
          statsList.push(stat_info);
        });

        //FOR DIST IMAGE
        //TODO Fix repeat code
        if (image_type == 'dist'){
          var plot_stats = []
          for (let i =0; i< statsList.length;i++){
            plot_stat = {...statsList[i].stats}
            plot_stat['xlabel'] = `${statsList[i].component} - ${vt}`;
            plot_stats.push(plot_stat)
          }
          let plotCan = plotNormDistMulti(plot_stats,            
            Width= getStorageValue('cy-node-width'),
            Height= getStorageValue('cy-node-height'));

          image_info[image_type][[dgt,vt]] = { 
            src:plotCan.node().toDataURL(),
            height: plotCan.height,
            width: plotCan.width}

          }
          else if (image_type == 'hist'){
            var plot_stats = []
            for (let i =0; i< statsList.length;i++){
              plot_stat = {...statsList[i].stats}
              plot_stat['xlabel'] = `${statsList[i].component} - ${vt}`;
              plot_stats.push(plot_stat)
            }
            let plotCan = plotMultiHist(plot_stats,            
              Width= getStorageValue('cy-node-width'),
              Height= getStorageValue('cy-node-height'));

            image_info[image_type][[dgt,vt]] = { 
              src:plotCan.node().toDataURL(),
              height: plotCan.height,
              width: plotCan.width}

            }
            else if (image_type == 'session_stats'){
              let comps = []
              let labels = []
              for (let i =0; i< statsList.length;i++){
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
                Width= getStorageValue('cy-node-width'),
                Height= getStorageValue('cy-node-height'));
  
              image_info[image_type][[dgt,vt]] = { 
                src:plotCan.node().toDataURL(),
                height: plotCan.height,
                width: plotCan.width}

            }

          
        
        //TODO,may need to build from image parts
        // else{
        //   var image_path = `${getSessionPath()}/${state.id}/images/${ndata.id}_${dgt}_${vt}__${image_type}.jpg`
        //   var img = makeImage(image_path)

        //   image_info[image_type][[dgt,vt]] = img  
        //   promise_list.push(loadImage(img))
        //} 
      });

      //INPUTS GET IMAGE
      if (dgt == 'INPUT'){
        image_info['heatmap']={}
        compList.forEach(function(comp){
          var image_path = `${getSessionPath()}/${state.id}/images/${comp.id}_${vt}__image.jpg`
          var img = makeImage(image_path)

          image_info['heatmap'][[dgt,vt]] = img  
          promise_list.push(loadImage(img))
        })
      }
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
        // var svg = runPlotToSVG();
        // var s = new XMLSerializer().serializeToString(svg.node())
        // console.log(s)
  

        // s = window.btoa(s)
        // style_update['background-image'] =   `url(data:image/svg+xml;utf8,${s})`
        style_update['background-image'] =   img.src
        //img.src//plotNormDist(-0.1,1.3,.2,0.1)//build_random_svg()//img.src;
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
          'border-color': '#444',
          'border-width': 5,
          'border-opacity': 0.5,
          'color': '#333',
          'content': 'data(label)',
          'shape': 'square',
          'font-size': getStorageValue('cy-font-size'),
          'background-color': '#FFF',
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
    var html_list = [];
    html_list.push(`<div class="row"><div class="col">`)
    html_list.push(`<h4>Node ID: ${node_data.id}</h3>`);

    head_html = `
      <table class="table table-sm">
      <tr><td>Node Operation: ${node_data.label}</td></tr>
      </table>`;
    html_list.push(head_html);
  
    html_list.push(`<hr/>`)

    html_list.push('</div></div>')
    html_list.push(`<div class="row"><div class="col">`)

    var actionList = []
    
    for (let comp in component_info){
      
      let stats = component_info[comp]['value']['tensor__stats']
      let component_html= [`
      <h6>Name: ${comp}</h6>
      <table class="table table-sm">
      <tr><td>Type: </td><td> ${component_info[comp].data_group_type}</td></tr>
      <tr><td>Shape:</td><td> (${component_info[comp].shape})</td></tr>`];    
   
      component_html.push(`<ul>`);
      for (const stat in stats){
        if (stat != 'histogram'){
          component_html.push(`<tr><td>${stat}:</td><td>${stats[stat]}</td></tr>`);
        }
      }
      component_html.push("</table>")

      html_list.push('</div></div>')
      html_list.push(`<div class="row"><div class="col">`)
      html_list.push(component_html.join("\n"));
      var image_path = `${getStatePath()}/images/${comp}_tensor__image.jpg`
      html_list.push(`<div class="img-holder"> <img src="${image_path}"/></div>              <hr/>`);
      var image_path = `${getStatePath()}/images/${comp}_first_delta__image.jpg`
      html_list.push(`<div class="img-holder"> <img src="${image_path}"/></div>`);
      html_list.push('</div></div>')
      html_list.push(`<div class="row"><div class="col">`);
      html_list.push(`<div class="canvas_box"><div id="${comp}Canvas1"></div></div>`);
      html_list.push(`<div class="canvas_box"><div id="${comp}StatsOverSessionCanvas1"></div></div>`);

      actionList.push(function(){ 
        var Width =400;
        var Height = 300;
        let canvas = plotHist(comp,stats,Width,Height);
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



      html_list.push('</div></div>')
      html_list.push(`<div class="row"><div class="col">`)

      if (component_info[comp].data_group_type == 'PARAM'){
        html_list.push(`<hr/>`)


        let stats = component_info[comp]['value']['grad__stats']

        let component_html= [`
        <h6>Name: ${comp}</h6>
        <table class="table table-sm">
        <tr><td>Type: </td><td> PARAM Gradient</td></tr>
        <tr><td>Shape:</td><td> (${component_info[comp].shape})</td></tr>`];    
     
        component_html.push(`<ul>`);
        for (const stat in stats){
          if (stat != 'histogram'){
            component_html.push(`<tr><td>${stat}:</td><td>${stats[stat]}</td></tr>`);
          }
        }
        component_html.push("</table>")
        html_list.push(component_html.join("\n"));
        
        html_list.push('</div></div>')
        html_list.push(`<div class="row"><div class="col">`)

        var image_path = `${getStatePath()}/images/${comp}_grad__image.jpg`
        html_list.push(`<div class="img-holder"> <img src="${image_path}"/></div>`);


        html_list.push('</div></div>')
        html_list.push(`<div class="row"><div class="col">`)


        html_list.push(`<div class="canvas_box"><div id="${comp}Canvas2"></div></div>`);
        html_list.push(`<div class="canvas_box"><div id="${comp}StatsOverSessionCanvas2"></div></div>`);
  
        actionList.push(function(){ 
          var Width =400;
          var Height = 300;
          let canvas = plotHist(comp,stats,Width,Height);
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
    
    html_list.push('<br/>')
    //html_list.push(JSON.stringify(this.data(), undefined, 2))
    html_list.push('</div></div>')

    document.getElementById("node_info").innerHTML = html_list.join("");
    actionList.forEach( f=>f())
    
  });
  return cy;
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


  await buildHeadPlot(getCurrentSessionData());

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
  await runPlot();


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

// document.getElementById("heatmap_radio_btn").addEventListener("click",() =>{
//   setStorageValue('current_image_type','heatmap');
//   renderNodeImages();
// });

// document.getElementById("dist_radio_btn").addEventListener("click",() =>{
//   setStorageValue('current_image_type','dist');
//   renderNodeImages();
// });


document.getElementById("hist_radio_btn").addEventListener("click",() =>{
  setStorageValue('current_image_type','hist');
  renderNodeImages();
});


document.getElementById("session_stats_radio_btn").addEventListener("click",() =>{
  setStorageValue('current_image_type','session_stats');
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
