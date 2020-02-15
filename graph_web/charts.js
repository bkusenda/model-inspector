

//https://stackoverflow.com/questions/39695967/d3-js-ordinal-scale-version-3-to-version-4
const buildHeadPlot = async (data) => {

  var chartDiv = document.getElementById("session_loss_plot");
  // Extract the width and height that was computed by CSS.
  var cwidth = chartDiv.clientWidth;
  var cheight = chartDiv.clientHeight;
  
  
  // set the dimensions and margins of the graph
  var margin = {top: 20, right: 20, bottom: 50, left: 50},
  width = cwidth - margin.left - margin.right,
  height = cheight - margin.top - margin.bottom;
  var active_metric = "loss";
  var padding = 0
  // set the ranges
  var xScale = d3.scaleLinear().range([0, width])
  var yScale = d3.scaleLinear().range([height, 0]);


    
  var svg = d3.select("#session_loss_plot").append("svg")
  .attr("width", cwidth)
  .attr("height", cheight)
  .append("g")
  .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

  // Get the data
  state_ids = data.state_ids
  metric_ids = data.metric_ids
  all_metrics = metric_ids.map((id)=>data.session_metrics[id])
  state_metrics = state_ids.map((id)=>data.session_metrics[id])
  idxLookup = {}
  metric_ids.forEach(function(d,i){ idxLookup[d]=i})
  
  xScale.domain([0,metric_ids.length]);
  yScale.domain([0, d3.max(all_metrics, function(d) { 
    return d.metrics[active_metric]; })]);

  let xAxisGen = d3.axisBottom(xScale);

  xAxisGen.ticks(Math.min(30,metric_ids.length))
  xAxisGen.tickFormat((d,i) => metric_ids[d]);

  // define the line
  var valueline = d3.line()
  .x(function(d,i) { 
    return xScale(i) })
  .y(function(d) { 
    return yScale(d.metrics[active_metric]); });

  // Add the valueline path.
  svg.append("path")
    .data([all_metrics])
    .attr("class", "line")
    .attr("transform", "translate(0,0)")
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
    .attr("cx", function(d, i) { return xScale(idxLookup[d.id]) })
    .attr("cy", function(d) { return yScale(d.metrics[active_metric]) })
    .attr("r", radius)
    .on("click", async function(d){
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
  
  var currentTransform = null
  var view = svg.append("g")
      .attr("class", "view");
  if (currentTransform) view.attr('transform', currentTransform);
  var zoom = d3.zoom()
  .scaleExtent([0.5, 5])
  .translateExtent([
      [-width * 2, -height * 2],
      [width * 2, height * 2]
  ])
  .on("zoom", zoomed);
    
  function zoomed() {
    currentTransform = d3.event.transform;
    view.attr("transform", currentTransform);
    gX.call(xAxis.scale(d3.event.transform.rescaleX(xScale)));
    gY.call(yAxis.scale(d3.event.transform.rescaleY(yScale)));
  }
  svg.call(zoom);
  }    
  

//PLOTTING FUNCTIONS 
function plotNormDistMulti( 
    statsList,
    dotsCount = 10, 
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
    return canvas;
  }
  
  function plotNormDistAsCanvas( 
    xlabel,
    minval,
    maxval,
    mean ,
    sigma , 
    context,
    dotsCount = 200, 
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
      var tickCount = 5,
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
    //.curve(d3.curveLinear)
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
  
//PLOTTING FUNCTIONS 
function plotMultiHist(
  statsList,
  Width=300, 
  Height=200,
  margin = {top: 20, right: 20, bottom: 60, left: 40}){

  const canvas = d3.select(document.createElement( 'canvas' ) ).attr("width", Width).attr("height", Height);
  var ctx = canvas.node().getContext('2d')

  var graphCount = statsList.length
  var plotHeight = Math.round(Height /graphCount)
  var yTicks = Math.round(8/graphCount);
  margin.top = Math.round(margin.top/graphCount)
  margin.bottom = Math.round(margin.bottom/graphCount) + 10 //10 for xaxis label

  for (i = 0;i< graphCount;i++){
    var stat = statsList[i]

    plotHistAsCanvas(
    stat.xlabel,
    stat,
    ctx,  
    Width=Width, 
    Height=plotHeight, 
    xoffset = 0,
    yoffset = i * plotHeight,
    margin = margin,
    yTicks = yTicks)
  }
  return canvas;
}

function plotHist( 
  label,
  stat,
  Width=300, 
  Height=200, 
  margin = {top: 20, right: 20, bottom: 40, left: 40}){

  const canvas = d3.select(document.createElement( 'canvas' ) ).attr("width", Width).attr("height", Height);
  var ctx = canvas.node().getContext('2d')

  plotHistAsCanvas(
  label,
  stat,
  ctx,  
  Width=Width, 
  Height=Height, 
  xoffset = 0,
  yoffset = 0,
  margin = margin)
  
  return canvas;
}

  function plotHistAsCanvas( 
    xlabel,
    stats,
    context,
    Width=300, 
    Height=200, 
    xoffset = 0,
    yoffset = 0,
    margin = {top: 20, right: 20, bottom: 40, left: 50},
    yTicks = 10){
  
   
    const width = Width - margin.right - margin.left;
    const height= Height - margin.top - margin.bottom;
    
    context.translate(margin.left, margin.top);
    context.font = "8px monospace";
    context.fillStyle = 'black'
    
    const xScale = d3.scaleLinear().rangeRound([xoffset, width+xoffset]);
    const yScale = d3.scaleLinear().rangeRound([height+yoffset, yoffset]);
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(  yScale);
  
    function drawXAxis(tickValues) {
      var tickCount = 4,
          tickSize = 6,
          ticks = xScale.ticks(tickCount);
          

      context.fillStyle = 'black'
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
      var formatter = d3.format(".3f")
      ticks.forEach(function(d) {
        context.fillText(formatter(tickValues[d]), xScale(d), height + tickSize+yoffset);
      });
      context.fillText(xlabel, width/2, height + tickSize+yoffset+10);    
    }
  
  
    function drawYAxis() {
      var tickCount = 5,
          tickSize = 6,
          tickPadding = 3,
          ticks = yScale.ticks(yTicks),
          tickFormat = yScale.tickFormat(tickCount);
      context.fillStyle = 'black'

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
      ticks.forEach(function(d) {
        context.fillText(tickFormat(d), -tickSize - tickPadding, yScale(d));
      });
    }

    var data = stats['histogram'][0]
    var binValues = stats['histogram'][1]
    
    var thickness = Math.round(width/data.length);
    var thicknessPadding = -1

    //console.log(data)
    const yExtent = d3.extent(data, d => d);
    xScale.domain([0,data.length]);
    yScale.domain(yExtent);

    context.beginPath();
    context.fillStyle = "steelblue";
    data.forEach(function(d,i) {
      context.rect(xScale(i), yScale(d), thickness - thicknessPadding ,height-yScale(d)+yoffset);
    });
    context.fill();
    context.closePath();

    context.fillStyle = "black";
    drawXAxis(binValues)
    drawYAxis()
    context.translate(-margin.left, -margin.top);
  }

//PLOTTING FUNCTIONS 
function plotMultiStatsOverTime(
  labels,
  compNames,
  valueName,
  stateData,
  currentStateId,
  Width=300, 
  Height=200,
  margin = {top: 20, right: 20, bottom: 60, left: 40}){

  const canvas = d3.select(document.createElement( 'canvas' ) )
    .attr("width", Width)
    .attr("height", Height);
  let ctx = canvas.node().getContext('2d')

  var graphCount = compNames.length
  var plotHeight = Math.round(Height /graphCount)
  var yTicks = Math.round(8/graphCount);
  margin.top = Math.round(margin.top/graphCount)
  margin.bottom = Math.round(margin.bottom/graphCount) + 10 //10 for xaxis label

  for (let i = 0;i< graphCount;i++){
    let compName = compNames[i];
    let yoffset = i * plotHeight
    
    plotStatsOverTimeAsCanvas(
      labels[i],
      compName,
      valueName,
      stateData,
      currentStateId,
      ctx,
      Width=Width, 
      Height=plotHeight, 
      xoffset = 0,
      yoffset = yoffset,
      margin = margin,
      yTicks = yTicks)
    }
    
  return canvas;
}


  function plotStatsOverTime( 
    label,
    compName,
    valueName,
    stateData,
    currentStateId,
    Width=300, 
    Height=200, 
    margin = {top: 20, right: 20, bottom: 40, left: 40}){
  
    const canvas = d3.select(document.createElement( 'canvas' ) )
    .attr("width", Width)
    .attr("height", Height);

    var ctx = canvas.node().getContext('2d')
  
    plotStatsOverTimeAsCanvas(
      label,
      compName,
      valueName,
      stateData,
      currentStateId,
      ctx,  
      Width=Width, 
      Height=Height, 
      xoffset = 0,
      yoffset = 0,
      margin = margin,
      yTicks=10)
    
    return canvas;
  }


  function plotStatsOverTimeAsCanvas( 
    label,
    compName,
    valueName,
    stateData,
    currentStateId,
    context,
    Width=300, 
    Height=200, 
    xoffset = 0,
    yoffset = 0,
    margin = {top: 20, right: 20, bottom: 30, left: 40},
    yTicks = 10){
  
   
    const width = Width - margin.right - margin.left;
    const height= Height - margin.top - margin.bottom;
    context.translate(margin.left, margin.top);
    context.font = "8px monospace";
    context.fillStyle = 'black'
  
    var xlabel = label
  
    const xScale = d3.scaleLinear().rangeRound([0, width]);
    const yScale = d3.scaleLinear().rangeRound([height,0 ]);
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);
  
    function drawXAxis(tickValues) {
      var tickCount = 5,
          tickSize = 6,
          ticks = xScale.ticks(tickCount);
    
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
        context.fillText(tickValues[d], xScale(d), height + tickSize+yoffset);
      });
      context.fillText(xlabel, width/2, height + tickSize+yoffset+10);    
    }
  
    function drawYAxis() {
      var tickCount = yTicks,
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
      ticks.forEach(function(d) {
        context.fillText(tickFormat(d), -tickSize - tickPadding, yScale(d) + yoffset);
      });
    }
  
    function buildLine(xkey,ykey){
      return d3.line()
      //.curve(d3.curveLinear)currentStateId
      .x(d => xScale(d[xkey]))
      .y(d => yScale(d[ykey]) + yoffset)
      .context(context);
    }
    
    
    var area = d3.area()
      .x(function(d) { return xScale(d['idx']); })
      .y1(function(d) { return yScale(d['mean']-d['std']) + yoffset; })
      .y0(function(d) { return yScale(d['mean']+d['std']) + yoffset; })
      .context(context);
  
    var data = []
  
    var i=0;
    var tickValues = []
    var tickLookup = {}
    for (var sid in stateData){
      var state = stateData[sid];
      var d = state['data'][compName]['value'][valueName]
      d['idx'] = i;
      tickValues.push(sid)
      tickLookup[sid] = i
      d['std'] = Math.sqrt(d['variance'])
      data.push(d);
      i++;
    }
    
    const yMin = d3.min(data, d => d['mean']-d['std']);
    const yMax = d3.max(data, d => d['mean']+d['std']);
    yScale.domain([yMin,yMax]);
    const xExtent = d3.extent(data, d => d['idx']);
    xScale.domain(xExtent);
    //context.clearRect(0, yoffset, width, height);
    
    context.beginPath();
    area(data);
    context.lineWidth = 1;
    context.globalAlpha = 0.2;
    context.fillStyle = 'steelblue';
    context.fill();
    context.closePath();
  
    context.fillStyle = 'black';
    context.globalAlpha = 1.0;
   
    
    context.beginPath();
  
    buildLine('idx','mean')(data);
    context.lineWidth = 1;
    context.opacity = 0.9;
    context.strokeStyle = "steelblue";
    context.stroke();
    context.closePath();


    context.beginPath();
    context.fillStyle = '#c0392b';

    var yspan = yScale(yMax)-yScale(yMin);
    context.rect(xScale(tickLookup[currentStateId]),yoffset,4,Math.abs(yspan))
    context.rect(xScale(tickLookup[currentStateId]),yoffset+12,12,4)
    context.globalAlpha = 0.5;
    context.fill();
    context.closePath();

    context.fillStyle = 'black';
    context.globalAlpha = 1.0;
  
    drawXAxis(tickValues)
    drawYAxis()
    context.translate(-margin.left, -margin.top);
  
  }
  



  
  
  async function runPlot() {
    var Width = 360;
    var Height = 250;
    const canvas = d3.select(document.createElement( 'canvas' ) ).attr("width", Width).attr("height", Height);
    var context = canvas.node().getContext('2d');
  
  
    let compName = 'layer4.0.conv1.weight'
    let valueName = 'tensor__stats'
    //plotLines(window.appdata.stateData,compName,valueName,'0_3000',context,Width,Height,0,0)
    
  
    //$(".test_box").css("background-image", "url(" + canvas.node().toDataURL() + ")");
  }
  
  
  
  
  
  //https://stackoverflow.com/questions/39695967/d3-js-ordinal-scale-version-3-to-version-4
  function plotLinesSVG(
          stateData,
          compName,
          valueName,
          svg ,
          Width=300, 
          Height=200, 
          xoffset = 0,
          yoffset = 0,
          margin = {top: 20, right: 20, bottom: 30, left: 40} ){
  
  
    var xlabel = compName
  
    
    const width = Width - margin.right - margin.left;
    const height= Height - margin.top - margin.bottom;
    
    // var active_metric = "loss";
    var padding = 0
    // set the ranges
    var xScale = d3.scaleBand().padding([padding]).rangeRound([0, width])
    var yScale = d3.scaleLinear().range([height+yoffset, yoffset]);
      
    
    // Get the data
    var sdata = getCurrentSessionData();
    var state_ids = sdata.state_ids
    var metric_ids = sdata.state_ids
    var all_metrics = state_ids.map((id)=>sdata.session_metrics[id])
    var state_metrics = state_ids.map((id)=>sdata.session_metrics[id])
  
  
    var data = []
  
    var i=0;
    for (var sid in stateData){
      var state = stateData[sid];
      var d = state['data'][compName]['value'][valueName]
      d['id'] = sid;
      d['std'] = Math.sqrt(d['variance'])
      
      data.push(d);
      i++;
    }
  
    const yMin = d3.min(data, d => d['mean']-d['std']);
    const yMax = d3.max(data, d => d['mean']+d['std']);
    yScale.domain([yMin,yMax]);  
    xScale.domain(metric_ids);
    console.log(metric_ids)
  
    let xAxisGen = d3.axisBottom(xScale);
    
    let tickGap = Math.round(metric_ids.length/10.0)
  
    let xticks = metric_ids.filter((v,i)=>(i%tickGap)==0)
    
    xAxisGen.tickValues(xticks)
    xAxisGen.tickFormat((d,i) => xticks[i]);
  
    // define the line
    var valueline = d3.line()
    .x(function(d) { 
      val = xScale(d.id)
      return val; })
    .y(function(d) { 
      return yScale(d['mean']); });
  
    // Add the valueline path.
    svg.append("path")
      .data([data])
      .attr("class", "line")
      .attr("transform", "translate(0,0)")
      .attr("d", valueline);
  
    // Add the X Axis
    svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxisGen)    
  
  
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
    .text("y axis");      
  
    // Add the Y Axis
    svg.append("g")
    .attr("transform", "translate(0,0)")
      .call(d3.axisLeft(yScale));
  
    }    
    
    const svgToDataURL = svgStr => {
      const encoded = encodeURIComponent(svgStr)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22')
    
      const header = 'data:image/svg+xml,'
      const dataUrl = header + encoded
    
      return dataUrl
    }
    
  
  //$( document ).ready(function()
  function runPlotToSVG() {
    var Width = 360;
    var Height = 250;
    const svg = d3.select('body').append('svg')
      .attr("width", Width)
      .attr("height", Height);
  
    let compName = 'layer4.0.conv1.weight'
    let valueName = 'tensor__stats'
    margin = {top: 20, right: 20, bottom: 30, left: 40}
  
    plotLinesSVG(window.appdata.stateData,compName,valueName,svg,Width,Height,0,0,margin
      )
    return svg
  
  }
  
  //$( document ).ready(function()
  async function runPlotSVG() {
    var Width = 360;
    var Height = 250;
    const svg = d3.select('body').append('svg')
      .attr("width", Width)
      .attr("height", Height);
  
    let compName = 'layer4.0.conv1.weight'
    let valueName = 'tensor__stats'
    margin = {top: 20, right: 20, bottom: 30, left: 40}
  
    plotLinesSVG(window.appdata.stateData,compName,valueName,svg,Width,Height,0,0,margin
      )
  
    // var s = new XMLSerializer().serializeToString(svg.node())
    // // console.log(s)
    // // //var s = svgToDataURL(s)//window.btoa(s)
    // s = encodeSVG(s)
  
    // //s = window.btoa(s)
    // $(".test_box").css("background-image", `url(data:image/svg+xml;utf8,${s})`);
  }
  
  