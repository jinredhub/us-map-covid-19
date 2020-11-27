document.addEventListener('DOMContentLoaded', function(){

    let chart_width = $('.tabcontent').width();
    // const chart_width = document.querySelector('.tabcontent').getBoundingClientRect();
    console.log('chart_width: ', chart_width);
    let chart_height = chart_width * 0.6;
    const color = d3.scaleThreshold().range([    // scaleQuantize
        'rgb(255,255,178)',
        'rgb(254,217,118)',
        'rgb(254,178,76)',
        'rgb(253,141,60)',
        'rgb(240,59,32)', 
        'rgb(189,0,38)', 
      ]);

    const svg = d3.select('#renderMap')
        .append('svg')
        .attr('width', chart_width)
        .attr('height', chart_height)
        .style('background-color', '#fff');

    const projection = d3.geoAlbersUsa()
        .translate([0, 0]);

    const path = d3.geoPath(projection);

    const zoom_map = d3.zoom()
        .scaleExtent([0.5, 3.0])
        .translateExtent([
            [-1000, -500],
            [1000, 500]
        ])
        .on('zoom', function(){
            const offset = [
                d3.event.transform.x,
                d3.event.transform.y
            ];

            const scale = d3.event.transform.k * 2000;

            // update projection
            projection.translate(offset)
                .scale(scale);
            
            // update all shapes and paths
            svg.selectAll('.county')
                .transition()
                .attr('d', path);

            svg.selectAll('.state')
                .transition()
                .attr('d', path);

            svg.selectAll('.capitalCircle')
                .transition()
                .attr('cx', function(d){
                    return projection([d.longitude, d.latitude])[0];
                })
                .attr('cy', function(d){
                    return projection([d.longitude, d.latitude])[1];
                });

            svg.selectAll('.capitalName')
                .transition()
                .attr('x', function(d){
                    return projection([d.longitude, d.latitude])[0];
                })
                .attr('y', function(d){
                    return projection([d.longitude, d.latitude])[1] - 7;
                });
        });

    // apply drag event to g element
    const map = svg.append('g')
        .attr('id', 'map')
        .call(zoom_map)
        .call(
            zoom_map.transform,
            d3.zoomIdentity
                .translate(chart_width / 2, chart_height / 2)
                .scale(0.5)
        )
        .style('cursor', 'grab');
    
    // use invisible rectangle to cover the map, drag event will apply to this
    map.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', chart_width)
        .attr('height', chart_height)
        .attr('opacity', 0);

    const tooltip = d3.select('#renderMap')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    // display controller
    d3.select('#renderMap')
        .append('div')
        .attr('class', 'controller')
        .html(`
            <button type='button' id='zoomIn' data-zoom='in'><i class="fas fa-plus"></i></button><br>
            <hr>
            <button type='button' id='zoomIn' data-zoom='out'><i class="fas fa-minus"></i></button>
        `);

    d3.selectAll('.controller button').on('click', function(){
        let scale = 1;
        const direction = d3.select(this).attr('data-zoom');
        
        if(direction === 'in'){
            scale = 1.25;
        }
        else if(direction === 'out'){
            scale = 0.75;
        }

        map.transition()
            .call(zoom_map.scaleBy, scale);
    });

    // load files
    const files = [
        d3.json('./assets/counties-10m.json'),
        d3.csv('./assets/us-state-capitals.csv'),
        // d3.csv('/assets/covid-us-counties-month.csv'),
        d3.csv('./assets/covid-us-counties.csv'),
    ];
    console.log('aa');

    Promise.all(files.map(url => (url))).then(function(values){
        console.log('aa');
        console.log('values: ', values);

        const filterDate = '2020-10-26'.split('-').join('');

        // filter covid data by selected date
        const filteredCovidData = values[2].filter(function(val){
            const date = val.date.split('-').join('');

            return filterDate === date;
        });

        console.log('filteredCovidData: ', filteredCovidData);        

        // topojson feature converts
        const counties = topojson.feature(values[0], values[0].objects.counties).features;
        console.log('counties: ', counties);

        // combine filtered covid data with county map data
        counties.forEach(function(county_value, county_index){
            filteredCovidData.forEach(function(covid_value, covid_index){
                if(covid_value.fips === county_value.id){
                    counties[county_index].properties.covidCases = parseFloat(covid_value.cases);
                    counties[county_index].properties.covidDeaths = parseFloat(covid_value.deaths);                    
                }
            });
        });

        console.log('added corona data to counties: ', counties);

        color.domain([10, 100, 1000, 10000, 100000]);

        // display confirmed cases and deaths
        let totalConfirmedCasesNum = 0;
        let totalDeathsNum = 0;
        values[2].forEach(function(val){
            if(val.date === '2020-11-23'){
                totalConfirmedCasesNum += Number(val.cases);
                totalDeathsNum += Number(val.deaths);
            }
        });
        console.log('totalConfirmedCasesNum: ', totalConfirmedCasesNum);
        console.log('totalDeathsNum: ', totalDeathsNum);

        d3.select('#confirmedCasesInUS').text(numberWithCommas(totalConfirmedCasesNum));
        d3.select('#deathsInUS').text(numberWithCommas(totalDeathsNum));

        updateCounties(counties);

        function updateCounties(counties){
            const countySelection = map.selectAll('.county');
            const bindingCountyData = countySelection.data(counties);
            
            bindingCountyData.enter()
                .append('path')
                .attr('class', 'county')
                .attr('d', path)
                .attr('fill', function(d){
                    const cases = d.properties.covidCases;
                    return cases ? color(cases) : '#fff';
                    // return cases ? d3.interpolateYlOrRd(Math.log(cases)/Math.log(10)/6) : '#fff';
                })
                .attr('stroke', 'transparent')
                .attr('stroke-width', 1)
                .on('mouseover', function(d){
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);
                    tooltip.html(`
                            <strong>${d.properties.name}</strong><br>
                            Confirmed: <span style='color: red; font-weight: bold;'>${d.properties.covidCases ? numberWithCommas(d.properties.covidCases) : 0}</span> cases<br>
                            Deaths: <span style='color: red; font-weight: bold;'>${d.properties.covidDeaths ? numberWithCommas(d.properties.covidDeaths) : 0}</span>
                        `);

                    const tooltipWidth = document.querySelector('.tooltip').offsetWidth;
                    const tooltipHeight = document.querySelector('.tooltip').offsetHeight;

                    tooltip.style('left', d3.mouse(this)[0] - (tooltipWidth / 2) + 'px')
                        .style('top', d3.mouse(this)[1] - (tooltipHeight + 24) + 'px');
                })
                .on('mouseout', function(d){
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0);
                });

            bindingCountyData.select('.county')
                .attr('fill', function(d){
                    const cases = d.properties.covidCases;
                    return cases ? color(cases) : '#fff';
                    // return cases ? d3.interpolateYlOrRd(Math.log(cases)/Math.log(10)/6) : '#fff';
                });
        }
        

        // topojson feature converts
        const states = topojson.feature(values[0], values[0].objects.states).features;
        console.log('states: ', states);

        map.selectAll('.state')
            .data(states)
            .enter()
            .append('path')
            .attr('class', 'state')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#3b3b3b')
            .attr('stroke-width', 1)
            .on('click', function(d){
                console.log('clicked state');
                d3.select(this).classed('selected', true);
            });
            
        map.selectAll('.capitalCircle')
            .data(values[1])
            .enter()
            .append('circle')
            .classed('capitalCircle', true)
            .style('fill', '#000000')
            .attr('cx', function(d){
                return projection([d.longitude, d.latitude])[0];
            })
            .attr('cy', function(d){
                return projection([d.longitude, d.latitude])[1];
            })
            .attr('r', 2);

        renderTable(values[2], false);

        // show more button
        $('.showMoreButton').on('click', function(){
            renderTable(values[2], true);
        });

        d3.select(window).on('resize', function(){
            // get new width and height
            chart_width = $('.tabcontent').width();
            chart_height = chart_width * 0.6;

            svg.attr('width', chart_width)
                .attr('height', chart_height)

            // update projection
            projection
                .translate([chart_width / 2, chart_height / 2])
                .scale(1);

            svg.selectAll('.county')
                .transition()
                .attr('d', path);

            svg.selectAll('.state')
                .transition()
                .attr('d', path);

            svg.selectAll('.capitalCircle')
                .transition()
                .attr('cx', function(d){
                    return projection([d.longitude, d.latitude])[0];
                })
                .attr('cy', function(d){
                    return projection([d.longitude, d.latitude])[1];
                });

            svg.selectAll('.capitalName')
                .transition()
                .attr('x', function(d){
                    return projection([d.longitude, d.latitude])[0];
                })
                .attr('y', function(d){
                    return projection([d.longitude, d.latitude])[1] - 7;
                });

        });

        // map.selectAll('.capitalName')
        //     .data(values[1])
        //     .enter()
        //     .append('text')
        //     .classed('capitalName', true)
        //     .attr('id', function(d){
        //         console.log('d: ', d)
        //         // return 'capitalName' + d.fips;
        //     })
        //     .text(function(d){
        //         return d.description;
        //     })
        //     .attr('x', function(d){
        //         return projection([d.longitude, d.latitude])[0];
        //     })
        //     .attr('y', function(d){
        //         return projection([d.longitude, d.latitude])[1] - 7;
        //     })
        //     .style('text-anchor', 'middle')
        //     .style('font-size', '10')
        //     .style('font-family', 'sans-serif');
            
        // map.selectAll('.rectBehindCapitalName')
        //     .data(values[1])
        //     .enter()
        //     .append('rect')
        //     .classed('rectBehindCapitalName', true)
        //     .attr('x', function(d){
        //         return projection([d.longitude, d.latitude])[0];
        //     })
        //     .attr('y', function(d){
        //         return projection([d.longitude, d.latitude])[1] - 7;
        //     })
        //     .attr('width', '20')
        //     .attr('height', '20')
        //     .style('fill', 'green');

    });

    function numberWithCommas(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function renderTable(data, renderAllRows){
        const latestDate = data[data.length - 1].date.split('-').join('');

        let filteredData = data.filter(function(val){
            return val.date.split('-').join('') === latestDate;
        })
        if(renderAllRows === false){
            filteredData = filteredData.slice(0, 8);
        }

        // empty table
        $('.myTable tbody').html('');

        filteredData.forEach(function(val){
            if(val.date.split('-').join('') === latestDate){
                $('.myTable tbody').append(`
                    <tr>
                        <td>${val.state}</td>
                        <td>${val.county}</td>
                        <td>${val.cases ? val.cases : 0}</td>
                        <td>${val.deaths ? val.deaths : 0}</td>
                    </tr>
                `)
            }
        });

        if(renderAllRows === false){
            $('.showMoreButton').show();
        }
        else if(renderAllRows === true){
            $('.showMoreButton').hide();
        }
    }


    

});