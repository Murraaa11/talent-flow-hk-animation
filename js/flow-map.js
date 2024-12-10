class FlowMap {
  constructor({
    container,
    data,
    location,
    direction,
    display,
    topo,
    countries,
    topoFeatureObject,
    color,
    x,
  }) {
    this.container = container;
    this.data = data;
    this.location = location;
    this.direction = direction;
    this.display = display;
    this.topo = topo;
    this.countries = countries;
    this.topoFeatureObject = topoFeatureObject;
    this.color = color;
    this.x = x;
    this.resize = this.resize.bind(this);
    this.init();
  }

  init() {
    this.topoWidth = 975;
    this.topoHeight = 610;

    //this.projection = d3.geoAlbersUsa();
    //this.projection = d3.geoMercator();
    this.projection = d3.geoEquirectangular();

    this.path = d3.geoPath(this.projection);
  

    this.container.classed("flow-map", true);
    this.svg = this.container.append("svg");
    this.defs = this.svg.append("defs");
    this.defs.append("marker");
    this.defineMarker();
    this.defs.append("g").attr("class", "inbound-gradients-defs");
    this.defs.append("g").attr("class", "outbound-gradients-defs");
    this.defs.append("g").attr("class", "flows-defs");
    this.defs.append("g").attr("class", "labels-defs");
    this.defs.append("g").attr("class", "values-defs");
    this.svg.append("g").attr("class", "locations-g");
    this.svg.append("g").attr("class", "fills-g");
    this.svg.append("g").attr("class", "flow-flows-g");
    this.svg.append("g").attr("class", "flow-arrows-g");
    this.svg.append("g").attr("class", "flow-hits-g");
    this.svg.append("g").attr("class", "labels-g");
    this.svg.append("g").attr("class", "values-g");

    this.tooltip = new FlowTooltip({
      container: this.container,
      color: this.color,
    });

    this.wrangleData();
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  wrangleData() {
    // Simplify topojson

    const simplified = topojson.presimplify(this.countries);
    const minWeight = topojson.quantile(simplified, 0.2);
    this.countries = topojson.simplify(simplified, minWeight);

    this.merged = topojson.feature(
      this.topo,
      this.topo.objects["geo"],
    );

    // console.log("merged: ", this.merged);

    this.countryById = new Map(
      this.merged.features.map((feature) => [feature.id, feature])
    );


    this.featureCollection = topojson.feature(
      this.countries,
      this.countries.objects[this.topoFeatureObject]
    );
    // console.log("featureCollection: ", this.featureCollection);
    const featureById = new Map(
      this.featureCollection.features.map((feature) => [feature.id, feature])
    );
    this.locations = this.data.nodes.map((d) =>
      Object.assign(
        {
          feature: featureById.get(d.id),
        },
        d
      )
    );

    // console.log("locations: ", this.locations);
    this.locationById = new Map(this.locations.map((d) => [d.id, d]));
  }

  resize() {
    this.width = this.container.node().clientWidth;
    this.height = Math.min(
      this.topoHeight,
      Math.ceil((this.width / this.topoWidth) * this.topoHeight)
    );

    this.projection.fitSize([this.width, this.height], this.featureCollection);

    this.svg.attr("viewBox", [0, 0, this.width, this.height]);

    this.updateData();
  }

  updateData() {
    this.locations.forEach((d) => {
      [d.x, d.y] = this.path.centroid(d.feature);
      // some country label might not be at the center of the area (adjust manually)
      switch (d.feature.properties.abbr) {
        case 'USA':
          d.x += 20; d.y += 20;
          break;
        case 'SBA':
          d.x += -30; d.y += 20;
          break;
        case 'GBA':
          d.x += 30; d.y += 40;
          break;
        // case 'CHN':
        //   d.x += 60; d.y += -40;
        //   break;
        case 'IND':
          d.x += -15; d.y += -10;
          break;
        case 'JPN':
          d.x += 15; d.y += -15;
          break;
        case 'GBR':
          d.x += 0; d.y += -10;
          break;
        case 'MAC':
          d.x += 0; d.y += 15;
          break;
        case 'FRA':
          d.x += 10; d.y += -12;
          break;
      }
    });

  
    console.log(this.locations);
    const location = this.locationById.get(this.location);
    let flows = [];
    if (this.display === "all") {
      if (this.direction === "both") {
        flows = [...location.inbounds, ...location.outbounds];
      } else {
        flows = location[`${this.direction}s`];
      }
    }
    else {
      if (this.direction === "both") {
        let outflows = [...location.outbounds];
        let inflows = [...location.inbounds];
        outflows.sort((a, b) => d3.descending(a.value, b.value));
        inflows.sort((a, b) => d3.descending(a.value, b.value));
        flows = [...outflows.slice(0, 10), ...inflows.slice(0,10)];
      }
      else {
        flows = location[`${this.direction}s`];
        flows.sort((a, b) => d3.descending(a.value, b.value));
        flows = flows.slice(0, 10);
      }
    }

    this.flows = flows.map((d) => ({
      id: `${d.source}-${d.target}`,
      source: this.locationById.get(d.source),
      target: this.locationById.get(d.target),
      value: d.value,
    }));


    //console.log(this.locations);

    const sources = flows.map((d) => 
      this.locationById.get(d.source)
    );

    const targets = flows.map((d) => 
      this.locationById.get(d.target)
    );

    //delete duplicated label
    const seen = new Set();
    this.labels = sources.concat(targets)
      .map(label => ({...label, selected: label.id === this.location ? true : false}))
      .filter(label => {
          if (seen.has(label.id)) {
              return false; // 如果 id 已存在，过滤掉
          } else {
              seen.add(label.id); // 否则，添加到 Set
              return true; // 保留当前对象
          }
      });

    console.log("labels: ", this.labels);


    this.merged_fill = this.labels.map((d) =>
      Object.assign(
        {
          feature: this.countryById.get(d.id),
        },
      )
    );

    console.log("merged fill: ", this.merged_fill);
    console.log("merged: ", this.merged);

    this.define();
  }

  define() {
    this.defineInboundGradients();
    this.defineOutboundGradients();
    this.defineFlows();
    this.defineLabels();
    this.defineValues();
    this.render();
  }

  render() {
    this.renderLocations();
    this.renderFills();
    this.renderFlowFlows();
    this.renderFlowArrows();
    this.renderFlowHits();
    this.renderLabels();
    // this.renderValues();
  }

  defineMarker() {
    this.defs
      .select("marker")
      .attr("id", "flow-arrowhead")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 10)
      .attr("refY", 5)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .attr("markerUnits", "userSpaceOnUse")
      .append("path")
      .attr("d", "M0,0L10,5L0,10")
      // .attr("stroke", "yellow")
      // .attr("fill", "yellow");
  }

  defineInboundGradients() {
    this.defs
      .select(".inbound-gradients-defs")
      .selectAll("linearGradient")
      .data(this.flows, (d) => d.id)
      .join((enter) =>
        enter
          .append("linearGradient")
          .attr("id", (d) => `flow-inbound-gradient-${d.id}`)
          .attr("x1", 0)
          .attr("y1", 0)
          .attr("x2", 1)
          .attr("y2", 0)
      )
      .attr("gradientTransform", (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        return `rotate(${angle}, 0.5, 0.5)`;
      })
      .selectAll("stop")
      .data(this.color.inbounds.domain())
      .join("stop")
      .attr("stop-color", (d) => this.color.inbounds(d))
      .attr("offset", (d, i) => (i ? "100%" : "25%"));
  }

  defineOutboundGradients() {
    this.defs
      .select(".outbound-gradients-defs")
      .selectAll("linearGradient")
      .data(this.flows, (d) => d.id)
      .join((enter) =>
        enter
          .append("linearGradient")
          .attr("id", (d) => `flow-outbound-gradient-${d.id}`)
          .attr("x1", 0)
          .attr("y1", 0)
          .attr("x2", 1)
          .attr("y2", 0)
      )
      .attr("gradientTransform", (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        return `rotate(${angle}, 0.5, 0.5)`;
      })
      .selectAll("stop")
      .data(this.color.outbounds.domain())
      .join("stop")
      .attr("stop-color", (d) => this.color.outbounds(d))
      .attr("offset", (d, i) => (i ? "100%" : "25%"));
  }

  defineFlows() {
    this.defs
      .select(".flows-defs")
      .selectAll("g")
      .data(this.flows, (d) => d.id)
      .join((enter) =>
        enter
          .append("g")
          .call((g) =>
            g
              .append("path")
              .attr("class", "flow-arrow-path")
              .attr("id", (d) => `flow-arrow-path-${d.id}`)
              // .attr("marker-end", "url(#flow-arrowhead)")
          )
          .call((g) =>
            g
              .append("path")
              .attr("id", (d) => `flow-animation-path-${d.id}`)
              .attr("stroke-width", 100) // 非常大的 stroke-width
              .attr("fill", "none")
              .attr("clip-path", (d) => `url(#flow-clip-${d.id})`) // 应用裁剪路径
          )
          .call((g) =>
            g
              .append("path")
              .attr("id", (d) => `flow-flow-path-${d.id}`)
              // .attr("stroke-width", 2) // 设置初始宽度
              // .attr("fill", "none") // 填充为无
          )
          .call((g) =>
            g
              .append("clipPath") // 定义裁剪路径
              .attr("id", (d) => `flow-clip-${d.id}`)
              .append("path")
              .attr("d", (d) => {
                const points = this.calculateBezierCurvePoints(
                  d.source.x,
                  d.source.y,
                  d.target.x,
                  d.target.y
                );
                const curve = new bezier.Bezier(...points);
                const length = curve.length();
                const offset = 12;
                const flowRadius = this.x(d.value) / 2;

                const flowCurve = curve.split(
                  (length - offset - flowRadius) / length
                ).left;
                const flowOutline = flowCurve.outline(0, 0, flowRadius, flowRadius);
                const flowTangent = flowCurve.derivative(1);
                const hypot = Math.hypot(flowTangent.x, flowTangent.y);
                flowTangent.x /= hypot;
                flowTangent.y /= hypot;
                const flowCapIndex = Math.ceil(flowOutline.curves.length / 2);
                const flowPath = flowOutline.curves
                  .map((segment, i) => {
                    if (i === flowCapIndex) {
                      let { x: x1, y: y1 } = segment.points[0];
                      let { x: x2, y: y2 } = segment.points[3];
                      const offsetX = (flowTangent.x * flowRadius * Math.PI) / 2;
                      const offsetY = (flowTangent.y * flowRadius * Math.PI) / 2;
                      x1 += offsetX;
                      y1 += offsetY;
                      x2 += offsetX;
                      y2 += offsetY;
                      segment.points[1] = { x: x1, y: y1 };
                      segment.points[2] = { x: x2, y: y2 };
                    }
                    return this.bezierToString(segment.points, i === 0);
                  }).join("");
                return flowPath
              })
          )
      )
      .each((d, i, ns) => {
        const points = this.calculateBezierCurvePoints(
          d.source.x,
          d.source.y,
          d.target.x,
          d.target.y
        );
        const curve = new bezier.Bezier(...points);
        const length = curve.length();

        const offset = 12;
        const flowRadius = this.x(d.value) / 2;
        const arrowOffset = 4;

        const arrowCurve = curve.split(
          (length - offset - arrowOffset) / length
        ).left;

        const arrowPath = this.bezierToString(arrowCurve.points, true);

        const EXTRA_LENGTH = 20; // 延伸的额外长度，動畫需要

        const animationCurve = curve.split(
          (length - offset - arrowOffset + EXTRA_LENGTH) / length
        ).left;
        
        const animationPath = this.bezierToString(animationCurve.points, true);

        const flowCurve = curve.split(
          (length - offset - flowRadius) / length
        ).left;

        const flowOutline = flowCurve.outline(0, 0, flowRadius, flowRadius);
        const flowTangent = flowCurve.derivative(1);
        const hypot = Math.hypot(flowTangent.x, flowTangent.y);
        flowTangent.x /= hypot;
        flowTangent.y /= hypot;
        const flowCapIndex = Math.ceil(flowOutline.curves.length / 2);
        const flowPath = flowOutline.curves
          .map((segment, i) => {
            if (i === flowCapIndex) {
              let { x: x1, y: y1 } = segment.points[0];
              let { x: x2, y: y2 } = segment.points[3];
              const offsetX = (flowTangent.x * flowRadius * Math.PI) / 2;
              const offsetY = (flowTangent.y * flowRadius * Math.PI) / 2;
              x1 += offsetX;
              y1 += offsetY;
              x2 += offsetX;
              y2 += offsetY;
              segment.points[1] = { x: x1, y: y1 };
              segment.points[2] = { x: x2, y: y2 };
            }
            return this.bezierToString(segment.points, i === 0);
          })
          .join("");


        const g = d3.select(ns[i]);
        g.select(`#flow-arrow-path-${d.id}`).attr("d", arrowPath);
        g.select(`#flow-flow-path-${d.id}`).attr("d", flowPath);
        g.select(`#flow-animation-path-${d.id}`).attr("d", animationPath);

        const pathElement = g.select(`#flow-animation-path-${d.id}`);
        const pathLength = pathElement.node().getTotalLength();
        // console.log("pathLength: ", pathLength);

        pathElement
            .attr("stroke-dasharray", pathLength) // 设置为路径的总长度
            .attr("stroke-dashoffset", pathLength) // 初始时隐藏路径
            .transition() // 添加过渡效果
            .duration(1000) // 过渡时长
            .attr("stroke-dashoffset", 0) // 最终显示完整路径


        const arrowElement = g.select(`#flow-arrow-path-${d.id}`);
        const arrowLength = arrowElement.node().getTotalLength();
        // console.log("arrowLength: ", arrowLength);

        arrowElement
            .attr("marker-end", null) // 临时移除箭头头部
            .attr("stroke-dasharray", arrowLength) // 设置为路径的总长度
            .attr("stroke-dashoffset", arrowLength) // 初始时隐藏路径
            .transition() // 添加过渡效果
            .duration(1000) // 过渡时长
            .attr("stroke-dashoffset", 0) // 最终显示完整路径
            .on("end", () => {
              // 动画结束后再添加箭头头部
              arrowElement.attr("marker-end", "url(#flow-arrowhead)");
            });
      });
      
  }



  // defineLabels() {
  //   //console.log(this.labels);
  //   this.defs
  //     .select(".labels-defs")
  //     .selectAll("g")
  //     .data(this.labels, (d) => d.id)
  //     .join((enter) =>
  //       enter
  //         .append("g")
  //         .attr("id", (d) => `label-${d.id}`)
  //         .call((g) =>
  //           g
  //             .append("text")
  //             .attr("class", (d) => {
  //               if (d.selected){
  //                 console.log(`label-${d.feature.properties.name}: ${d.selected}`);
  //                 return "label-specialtext label-specialtext--halo";
  //               } else {
  //                 return "label-text label-text--halo";
  //               }
  //             })
  //             .attr("text-anchor", "middle")
  //             .attr("dy", "0.32em")
  //             .text((d) => d.feature.properties.name === 'China' ? 'Mainland China' : d.feature.properties.name)
  //         )
  //         .call((g) =>
  //           g
  //             .append("text")
  //             .attr("class", (d) => {
  //               if (d.selected){
  //                 console.log(`label-${d.feature.properties.name}: ${d.selected}`);
  //                 return "label-specialtext";
  //               } else {
  //                 return "label-text";
  //               }
  //             })
  //             .attr("text-anchor", "middle")
  //             .attr("dy", "0.32em")
  //             .style("fill", (d) => {
  //               if (d.selected) {
  //                 console.log(`label-${d.feature.properties.name}: ${d.selected}`);
  //                 return "#a61629";
  //               } else {
  //                 return "black";
  //               }
  //             })
  //             .text((d) => d.feature.properties.name === 'China' ? 'Mainland China' : d.feature.properties.name)
  //         )
  //     )
      // .attr("transform", (d) => `translate(${d.x},${d.y})`)
      // .attr("opacity", 0) // 初始为透明
      // .transition()
      // .duration(1500)
      // .attr("opacity", 1); // 过渡到不透明
  // }


  
  defineLabels() {
    this.defs
      .select(".labels-defs")
      .selectAll("g")
      .data(this.labels, (d) => d.id)
      .join(
        (enter) => {
          // 处理进入的新元素
          const g = enter.append("g")
            .attr("id", (d) => `label-${d.id}`);

          // 添加文本元素
          g.append("text")
            .attr("id", "text1")
            .attr("class", (d) => {
              if (d.selected) {
                return "label-specialtext label-specialtext--halo";
              } else {
                return "label-text label-text--halo";
              }
            })
            .attr("text-anchor", "middle")
            .attr("dy", "0.32em")
            .text((d) => d.feature.properties.name === 'China' ? 'Mainland China' : d.feature.properties.name);

          g.append("text")
            .attr("id", "text2")
            .attr("class", (d) => {
              if (d.selected) {
                return "label-specialtext";
              } else {
                return "label-text";
              }
            })
            .attr("text-anchor", "middle")
            .attr("dy", "0.32em")
            .style("fill", (d) => {
              if (d.selected) {
                return "#a61629";
              } else {
                return "black";
              }
            })
            .text((d) => d.feature.properties.name === 'China' ? 'Mainland China' : d.feature.properties.name);

          g.attr("transform", (d) => `translate(${d.x},${d.y})`)
            .attr("opacity", 0) // 初始为透明
            .transition()
            .duration(1500)
            .attr("opacity", 1); // 过渡到不透明

          return g;
        },
        (update) => {
          // 处理更新的元素
          update.each((d, i, nodes) => {
            const g = d3.select(nodes[i]); // 获取当前元素的选择集
            // 根据条件处理
            if (d.selected) {
                g.select("#text1")
                  .attr("class", "label-specialtext label-specialtext--halo");
                g.select("#text2")
                  .attr("class", "label-specialtext")
                  .style("fill", "#a61629");
            } else {
              g.select("#text1")
                .attr("class", "label-text label-text--halo");
              g.select("#text2")
                .attr("class", "label-text")
                .style("fill", "black");
            }

            g.attr("transform", (d) => `translate(${d.x},${d.y})`)
              .attr("opacity", 0) // 初始为透明
              .transition()
              .duration(1500)
              .attr("opacity", 1); // 过渡到不透明
          });
        },
      );
}



  defineValues(){
    this.defs
      .select(".values-defs")
      .selectAll("g")
      .data(this.flows, (d) => d.id)
      .join((enter) =>
        enter
          .append("g")
          .attr("id", (d) => `value-${d.id}`)
          .call((g) =>
            g
              .append("text")
              .attr("class", "label-text label-text--halo")
              .attr("text-anchor", "middle")
              // .attr("dy", "-0.88em")
              .text((d) => d.value)
          )
          .call((g) =>
            g
              .append("text")
              .attr("class", "label-text")
              .attr("text-anchor", "middle")
              // .attr("dy", "-0.88em")
              .text((d) => d.value)
          )

      )
      .each((d, i, ns) => {
        const points = this.calculateBezierCurvePoints(
          d.source.x,
          d.source.y,
          d.target.x,
          d.target.y
        );
        const curve = new bezier.Bezier(...points);
        const length = curve.length();
        const offset = 12;
        const arrowOffset = 4;

        const arrowCurve = curve.split(
          (length - offset - arrowOffset) / length
        ).left;

        const midpoint = this.calculateBezierOnCurvePoint(0.5, arrowCurve.points);
        const g = d3.select(ns[i]);
        g.attr("transform", (d) => `translate(${midpoint.x},${midpoint.y})`);

      })
      .attr("opacity", 0) // 初始为透明
      .transition()
      .duration(1500)
      .attr("opacity", 1); // 过渡到不透明
  }

  renderLocations() {
    this.svg
      .select(".locations-g")
      .selectAll(".locations-features-path")
      .data(this.merged.features)
      .join((enter) =>
        enter.append("path").attr("class", "locations-features-path")
      )
      .attr("d", (d) => this.path(d));
  }

  renderFills() {
    this.svg
      .select(".fills-g")
      .selectAll(".locations-fills-path")
      .data(this.merged_fill)
      .join((enter) =>
        enter.append("path").attr("class", "locations-fills-path")
      )
      .attr("d", (d) => this.path(d.feature))
      .attr("fill-opacity", 0) // 初始填充透明度为0
      .transition() // 添加过渡效果
      .duration(1000) // 设置过渡时长
      .attr("fill-opacity", 1) // 过渡到不透明
  }

  renderFlowFlows() {
    this.svg
      .select(".flow-flows-g")
      .selectAll(".flow-flow-use")
      .data(this.flows, (d) => d.id)
      .join((enter) =>
        enter
          .append("use")
          .attr("class", "flow-flow-use")
          .attr("href", (d) => `#flow-animation-path-${d.id}`)
          .attr("stroke", (d) => {
            if (d.source.id === this.location) {
              return `url(#flow-outbound-gradient-${d.id})`;
            } else {
              return `url(#flow-inbound-gradient-${d.id})`;
            }
          })
      );
  }

  renderFlowArrows() {
    this.svg
      .select(".flow-arrows-g")
      .selectAll(".flow-arrow-use")
      .data(this.flows, (d) => d.id)
      .join((enter) =>
        enter
          .append("use")
          .attr("class", "flow-arrow-use")
          .attr("href", (d) => `#flow-arrow-path-${d.id}`)
      );
  }


  renderFlowHits() {
    this.svg
      .select(".flow-hits-g")
      .selectAll(".flow-hit-use")
      .data(this.flows, (d) => d.id)
      .join((enter) =>
        enter
          .append("use")
          .attr("class", "flow-hit-use")
          .attr("href", (d) => `#flow-arrow-path-${d.id}`)
          .on("mouseover", (event, d) => {
            this.highlightFlows(d);
            this.tooltip.show(d, d.source.id === this.location);
          })
          .on("mouseout", (event, d) => {
            this.resetHighlightFlows();
            this.tooltip.hide();
          })
          .on("mousemove", (event, d) => {
            this.tooltip.move(event);
          })
      );
  }

  renderLabels() {
    this.svg
      .select(".labels-g")
      .selectAll(".label-use")
      .data(this.locations, (d) => d.id)
      .join((enter) =>
        enter
          .append("use")
          .attr("class", "label-use")
          .attr("href", (d) => `#label-${d.id}`)
      );
  }

  renderValues() {
    this.svg
      .select(".values-g")
      .selectAll(".value-use")
      .data(this.flows, (d) => d.id)
      .join((enter) =>
        enter
          .append("use")
          .attr("class", "value-use")
          .attr("href", (d) => `#value-${d.id}`)
      );
  }

  highlightFlows(d) {
    this.svg
      .select(".flow-flows-g")
      .selectAll(".flow-flow-use")
      .style("opacity", (e) => (e === d ? 1 : 0.1));
    this.svg
      .select(".flow-arrows-g")
      .selectAll(".flow-arrow-use")
      .style("opacity", (e) => (e === d ? 1 : 0.1));
  }

  resetHighlightFlows() {
    this.svg
      .select(".flow-flows-g")
      .selectAll(".flow-flow-use")
      .style("opacity", 1);
    this.svg
      .select(".flow-arrows-g")
      .selectAll(".flow-arrow-use")
      .style("opacity", 1);
  }

  calculateBezierCurvePoints(x1, y1, x2, y2) {
    const r = Math.hypot(x1 - x2, y1 - y2);
    const curves = SVGArcToCubicBezier({
      px: x1,
      py: y1,
      cx: x2,
      cy: y2,
      rx: r,
      ry: r,
      xAxisRotation: 0,
      largeArcFlag: 0,
      sweepFlag: 0,
    });
    const curve = curves[0];
    return [
      { x: x1, y: y1 },
      { x: curve.x1, y: curve.y1 },
      { x: curve.x2, y: curve.y2 },
      { x: x2, y: y2 },
    ];
  }

  bezierToString(points, first) {
    let commands = [];
    if (first) {
      commands.push("M", points[0].x, points[0].y);
    }
    switch (points.length) {
      case 3:
        commands.push("Q", points[1].x, points[1].y, points[2].x, points[2].y);
        break;
      case 4:
        commands.push(
          "C",
          points[1].x,
          points[1].y,
          points[2].x,
          points[2].y,
          points[3].x,
          points[3].y
        );
        break;
    }
    return commands.join(" ");
  }

  calculateBezierOnCurvePoint(t, control_points){
    const [p0, p1, p2, p3] = control_points;
    const x_t = (1-t)**3*p0.x+3*(1-t)**2*t*p1.x+3*(1-t)*t**2*p2.x+t**3*p3.x;
    const y_t = (1-t)**3*p0.y+3*(1-t)**2*t*p1.y+3*(1-t)*t**2*p2.y+t**3*p3.y;
    return {x: x_t, y: y_t};
  }

  onLocationChange(location) {
    this.location = location;
    this.updateData();
  }

  onDirectionChange(direction) {
    this.direction = direction;
    this.updateData();
  }

  onDisplayChange(display) {
    this.display = display;
    this.updateData();
  }
}
