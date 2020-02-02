//https://github.com/kaluginserg/cytoscape-node-html-label
//https://stackoverflow.com/questions/40261292/put-a-cytoscape-graph-inside-a-bootstrap-column

var win = $(window);

win.resize(function() {
  resize();
});

function resize() {
  console.log(win.height(), win.innerHeight());
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
var session_path = "session_data";
var session_id = "test";
var state_id = "0_4";

//STORAGE HELPERS
var defaultSettings={
  'cy-layout':'grid',
  'cy-font-size':20,
  'cy-node-width':100,
  'cy-node-height':100,
  'active_image': 'param',
  'node_render_type': 'fit',
  
}

function getStorageValue(key,defaultValue){
  if (localStorage.getItem(key)) {
    return localStorage.getItem(key);
  }
  else {
    return setStorageValue(key,defaultValue)
  }
}

function setStorageValue(key, value){
  localStorage.setItem(key,value);
  return value;
}


//LAYOUT HELPERS
function getLayoutConfig(name) {
  return {
    name: name,//grid?, dagre
    animate: false,
    directed: true,
    padding: 50,
    // marginy:'500',
    fit: true,
    // nodeOverlap: 2,
    spacingFactor: 1.5,
    // name: 'cola',
    // }
  };
}

const updateLayout = async (name) => {
  layoutConfig = getLayoutConfig(name);
  layout = cy.layout(layoutConfig);
  layout.run();
  setStorageValue('current_layout_name',name);
}

const refreshLayout = async => {
  current_layout_name = getStorageValue('current_layout_name','grid');
  updateLayout(current_layout_name);
}


// CREATE GRAPH

const initGraph = (state_id)=> {
  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),

    boxSelectionEnabled: false,
    autounselectify: true,

    style: cytoscape.stylesheet()
      .selector('node')
      .css({
        'background-fit': 'cover',
        //  'background-repeat':'repeat-y',
        'border-color': '#000',
        'border-width': 3,
        'border-opacity': 0.5,
        'content': 'data(label)',
        'shape': 'square',
        'font-size': getStorageValue('cy-font-size',defaultSettings['cy-font-size']),
        // 'background-image': 'https://live.staticflickr.com/3063/2751740612_af11fb090b_b.jpg'
      })
      .selector('edge')
      .css({
        'curve-style': 'bezier',
        // "control-point-distances": [40, -40],
        // "control-point-weights": [0.250, 0.75],
        'width': 2,
        'target-arrow-shape': 'triangle',
        'line-color': '#666666',
        'target-arrow-color': '#555555'
      }),

    elements: $.getJSON(`${session_path}/${session_id}/${state_id}/graph.json`),
    layout: getLayoutConfig('grid')
  });
  return cy;
}

initGraph(state_id);



const renderNodeImages = async (state_id) => {


  if (getStorageValue('node_render_type','fit') == 'fixed'){
    //if fixed, use this
    cy.style().selector('node').css({
      'height': getStorageValue('cy-node-height',defaultSettings['cy-node-height']),
      'width': getStorageValue('cy-node-width',defaultSettings['cy-node-width']),
      'font-size': getStorageValue('cy-font-size',defaultSettings['cy-font-size']),
      'background-fit':'cover'
    }).update();
  }

  cy.style().selector('node').css({
    'font-size': getStorageValue('cy-font-size',defaultSettings['cy-font-size']),
  }).update();

  return  await Promise.all(cy.nodes().map(function(node){
    component_info = node.data().component_info;
    var image_heights = [];
    var image_widths = [];
    var image_links = [];
    var last_vert = 0;
    var image_pos = [];

    for (var comp in component_info){

      if (comp in component_info && (component_info[comp]['data_group_type'] == "PARAM")){
//        src=`${state_id}/${comp}_param__image.jpg`;
        // node.style('background-image',src);
        if ('img' in component_info[comp]){

            
            nwidth = component_info[comp]['img']['param'].width;
            nheight = component_info[comp]['img']['param'].height;
            src = component_info[comp]['img']['param'].src;
            image_heights.push(nheight);
            image_widths.push(nwidth);
            image_links.push(`url(${src})`);
            last_vert = nheight+last_vert;
        
          
        }

      }
    }

    var style_update = {};
    if (image_heights.length >0){
      fsize = Math.max(Math.max(...image_heights) * 0.2,  
      getStorageValue('cy-font-size',defaultSettings['cy-font-size']));
      //node.style('font-size',fsize);
      style_update['font-size'] = fsize
    }

    if (image_widths.length >0){
      style_update['width'] = Math.max(...image_widths);
      node.style('width',nwidth);
    }

    if (image_heights.length >0){
      total_height = 0;
      for(i =0;i<image_heights.length;i++){
  
        total_height = total_height + Math.max(image_heights[i],10);

      }
      style_update['height'] = total_height;
      node.style('width',nwidth);
    }
    var fixed = getStorageValue('node_render_type',defaultSettings['node_render_type']) != 'fixed'

    if (image_links.length>0){
     // console.log(image_links);
      style_update['background-image'] = image_links.join(", ");
      // style_update['background-position'] = image_pos.join(", ");

      
      //node.style('background-image',image_links.join(","))
      node.removeStyle();
      node.style(style_update);

    }
    else {
      
    }

     

  }));


  

  // return cy.style().selector('node').css({
  //     'font-size': Math.max(...max_values)/2,
  //   }).update();

} 

const updateStyle = async () => {

  cy.style()
  .selector('node')
  .css({
    //'font-size': getStorageValue('cy-font-size',defaultSettings['cy-font-size']),
    'border-color': '#000',
    'border-width': 3,
    'border-opacity': 0.5,
    'content': 'data(label)',
    'shape': 'square',
    // 'background-image': 'https://live.staticflickr.com/3063/2751740612_af11fb090b_b.jpg'
  })
  .selector('node[label="Add"]')
  .css({
    'height': 20,
    'width': 20,
    'shape': 'diamond',
    //'visibility':'hidden'
  })
  .selector('node[label="Relu"]')
  .css({
    'height': 20,
    'width': 20,
    'shape': 'diamond',
    //'visibility':'hidden'
  })
  .selector('node[label="Flatten"],node[label="MaxPool"]')
  .css({
    'height': 20,
    'width': 20,
    'shape': 'diamond',
    //'visibility':'hidden'
  }).update();

  cy.nodes().leaves().style({ 'border-color': '#F00' });
  cy.nodes().roots().style({ 'border-color': '#0F0' });
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


// const checkImage = path =>
//     new Promise(resolve => {
//         const img = new Image();
//         img.onload = () => resolve({path, status: 'ok'});
//         img.onerror = () => resolve({path, status: 'error'});

//         img.src = path;
//     });

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
  component_ids = node.data().component_ids;
  var component_info = {};
  for (i=0;i<component_ids.length;i++){
    if (component_ids[i] in state['data']) {
      comp = component_ids[i];
      component_info[comp] = state['data'][comp];
      component_info[comp]['img'] = {}

      if (component_info[comp]['data_group_type'] == "PARAM"){
        component_info[comp]['img']['param'] = makeImage(`${session_path}/${session_id}/${state.id}/${comp}_param__image.jpg`)
        component_info[comp]['img']['grad'] = makeImage(`${session_path}/${session_id}/${state.id}/${comp}_grad__image.jpg`)
        //console.log(img.src)
        promise_list.push(loadImage(component_info[comp]['img']['param']))
        promise_list.push(loadImage(component_info[comp]['img']['grad']))
        
      }
      // else if (component_info[comp]['data_group_type'] == "BUFFER"){
      //   component_info[comp]['img']['tensor'] = makeImage(`${state_id}/${comp}_tensor__image.jpg`)       
      // }

    }
  }
  node.data('component_info',component_info);
  return await Promise.all(promise_list);
}

const loadState = async (state_id) => {
  console.log(state_id);
  var state = await $.getJSON(`${session_path}/${session_id}/${state_id}/state.json`)


  return await Promise.all(cy.nodes().map(function(node){
    return updateNodeInfo(node,state);  
  }));

}


const backupInitState = async () => {
  cy.orig_elements = cy.elements().clone();  
}
console.log(state_id);

cy.ready(() => {
  // cy.container().insertBefore(build_menu());   

  localStorage.clear();
  console.log(state_id);
  loadState(state_id).then
  (function(){backupInitState();}).then
  (function(){renderNodeImages(state_id)}).then
  (function(){updateStyle()}).then
  (function(){  updateLayout("grid")});
  console.log(state_id);



//   cy.style()
//   .selector('node')
//     .style({
//       'background-color': 'yellow',
//        'label':"data(id)",
//       // 'content': "data(id)"
//     }).update()

// ;


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
  <hr/>
  <h6>Components</h6>
  `;
  html_list.push(head_html);

  for (var comp in component_info){
    component_html = `
    <table class="table table-sm">
    <tr><td>Name: ${comp}</td></tr>
    <tr><td>Type: ${component_info[comp].data_group_type}</td></tr>
    <tr><td>Shape: (${component_info[comp].shape})</td></tr>
    `;    
    if (component_info[comp]['data_group_type'] == "PARAM"){
      component_html += `<tr><td>Value:<div class="img-holder"> <img src="${session_path}/${session_id}/${state_id}/${comp}_param__image.jpg"/></div></td></tr>`;
      component_html += `<tr><td>Gradient: <img src="${session_path}/${session_id}/${state_id}/${comp}_grad__image.jpg" width="300px" /></td></tr>`;
    }
    else if (component_info[comp]['data_group_type'] == "BUFFER"){
      component_html += `<tr><td>Value: <img src="${session_path}/${session_id}/${state_id}/${comp}_tensor__image.jpg" width="300px" /></td></tr>`;
    }


    component_html += "</table>"
    html_list.push(component_html);

  }
  
  document.getElementById("node_info").innerHTML = html_list.join("") + "<br/>"+ JSON.stringify(this.data(), undefined, 2);

  
});



  document.getElementById("font_plus_btn").addEventListener("click",() =>{
    current_font_size = getStorageValue('cy-font-size',defaultSettings['cy-font-size']);
    new_font_size = parseInt(current_font_size) + 10;
    setStorageValue('cy-font-size',new_font_size);
     renderNodeImages(state_id);
    // console.log(new_font_size);
    //   cy.style()
    //   .selector('node')
    //   .css({
    //     'font-size': new_font_size,
    // }).update();
  });


  document.getElementById("font_minus_btn").addEventListener("click",() =>{
    current_font_size = getStorageValue('cy-font-size',defaultSettings['cy-font-size']);
    new_font_size = parseInt(current_font_size) - 10;
    setStorageValue('cy-font-size',new_font_size);
    renderNodeImages(state_id);
  //   cy.style()
  //   .selector('node')
  //   .css({
  //     'font-size': new_font_size,
  // }).update();
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
  setStorageValue('cy-font-size',defaultSettings['cy-font-size']);
  restoreElements().then(function(){renderNodeImages(state_id);}).
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
  renderNodeImages(state_id).then(updateStyle).then(refreshLayout);
});

document.getElementById("node_size_fixed_btn").addEventListener("click",() =>{
  setStorageValue('node_render_type','fixed');
  setStorageValue('cy-font-size',defaultSettings['cy-font-size']);
  renderNodeImages(state_id).then(updateStyle).then(refreshLayout);
});


    // Pass the button, the tooltip, and some options, and Popper will do the
    // magic positioning for you:


    // cy.nodeHtmlLabel([{
    //   query: 'node',
    //   valign: "left",
    //   halign: "center",
    //   valignBox: "center",
    //   halignBox: "center",
    //   tpl: function (data) {
    //     image_st = "<table>";
    //     image_st += "<tr><td>id</td><td>"+data.id + "</td></tr>";
    //     for (cid in data.components) {
    //       component = data.components[cid];
    //       image_st += "<tr><td>Component</td><td>"+component + "</td></tr>";
          
    //       // for (iid in data.images[component]) {
    //       //   image_data = data.images[component][iid]
    //       //   if (image_data.filename.includes("param")) {
    //       //     image_st += '<img src="0_2/' + image_data.filename + '"  width="200" ><br/>';
    //       //   }
    
    //       // }
    
    //     }
    //     image_st += "</table>";
    //     //  console.log(image_st);
    //     return image_st;//'<p class="cy-title__p1">' + data.id + '</p>' + '<p  class="cy-title__p2">' + data.components + '</p>';
    //   }
    // }
    // ]);
