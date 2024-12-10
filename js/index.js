Promise.all([
  d3.csv("data/HK_flow_total.csv"),
  d3.json("data/worldmap_topojson_simplified.json"),
  d3.json("data/countries-10m.json"),
  d3.csv("data/country_chinese_name.csv"),
]).then(([data, us, country, chinese]) => {
  const { nodes, links } = processData(data, country, chinese);
  

  const color_in = d3
    .scaleOrdinal()
    .domain(["outbound", "inbound"])
    .range(["#ed3b9c", "#02a9e7"]);

  const color_out = d3
    .scaleOrdinal()
    .domain(["outbound", "inbound"])
    .range(["#ed3b9c", "#02a9e7"]);

  const color = {inbounds: color_in, outbounds: color_out};

  const x = d3
    .scaleSqrt()
    .domain([1, d3.max(links, (d) => d.value)])
    .range([1, 24]);

  const dispatch = d3.dispatch(
    "locationchange",
    "directionchange",
    "displaychange"
  );

  const selected = {
    location: "344",
    direction: "both",
    display: "top10",
  };

  new SelectControl({
    container: d3.select("#state-control"),
    label: "Countries/Regions",
    id: "state-select",
    options: nodes.map((d) => ({
      value: d.id,
      text: d.name,
    })),
    // options: [{value: '999', text: 'Great Bay Area'}, {value: '998', text: 'San Francisco Bay Area'}],
    initialValue: selected.location,
    onChange: (location) => {
      dispatch.call("locationchange", null, location);
    },
  });

  new RadiosControl({
    container: d3.select("#direction-control"),
    label: "Direction of Flow",
    name: "flow-direction-radio",
    options: [
      { value: "inbound", text: "Inflow", id: "flow-direction-inbound" },
      { value: "outbound", text: "Outflow", id: "flow-direction-outbound" },
      { value: "both", text: "Both", id: "flow-direction-both" },
    ],
    initialValue: selected.direction,
    onChange: (direction) => {
      dispatch.call("directionchange", null, direction);
    },
  });

  new RadiosControl({
    container: d3.select("#display-control"),
    label: "Display",
    name: "flow-display-radio",
    options: [
      { value: "top10", text: "Top-10", id: "flow-display-top10" },
      { value: "all", text: "All", id: "flow-display-all" },
    ],
    initialValue: selected.display,
    onChange: (display) => {
      dispatch.call("displaychange", null, display);
    },
  });

  new FlowLegend({
    container: d3.select("#flow-legend-inbound"),
    color: color_in,
    x,
    flowValues: [100, 200, 500, 1000], //可能要改
    tickValues: ["Outbound", "Inbound"],
    direction: "inbound",
  });

  // new FlowLegend({
  //   container: d3.select("#flow-legend-outbound"),
  //   color: color_out,
  //   x,
  //   flowValues: [100, 200, 500, 1000], //可能要改
  //   tickValues: ["Outbound", ""],
  //   direction: "outbound",
  // });

  const flowMap = new FlowMap({
    container: d3.select("#flow-map"),
    data: {nodes, links },
    location: selected.location,
    direction: selected.direction,
    display: selected.display,
    topo: us,
    countries: country,
    topoFeatureObject: "countries",
    color,
    x,
  });

  dispatch.on("locationchange", (location) => {
    selected.location = location;
    flowMap.onLocationChange(location);
  });

  dispatch.on("directionchange", (direction) => {
    selected.direction = direction;
    flowMap.onDirectionChange(direction);
  });

  dispatch.on("displaychange", (display) => {
    selected.display = display;
    flowMap.onDisplayChange(display);
  });
});

