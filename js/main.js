document.addEventListener('DOMContentLoaded', function(){
    // toggle between show/hide the mobile navbar menu
    $('.hamburgerIcon').on('click', function(){
        const container = document.querySelector('.mobildLinks');
        if(container.style.display === 'block'){
            container.style.display = "none";
        }
        else{
            container.style.display = 'block';
        }
    });
    
    // loading icon
    $('#loading').css('display', 'flex');

    let chart_width = $('.tabcontent').width();
    let chart_height = chart_width * 0.6;
    const color = d3.scaleThreshold().range([
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
        .translate([chart_width / 2, chart_height / 2])
        .scale(chart_width);

    const path = d3.geoPath(projection);

    const map = svg.append('g')
        .attr('id', 'map');

    const zoom = d3.zoom()
        .scaleExtent([1, 4])
        .on('zoom', function(){
            // use svg transforms to avoid the overhead of reprojecting at every zoom iteration
            // console.log('d3.event.transform: ', d3.event.transform);
            let x = d3.event.transform.x;
            let y = d3.event.transform.y;
            const k = d3.event.transform.k;
           
            if(x > 0){
                d3.event.transform.x = 0;
            }
            else if(x < (k - 1) * -chart_width){
                d3.event.transform.x = (k - 1) * -chart_width;
            }
            if(y > 0){
                d3.event.transform.y = 0;
            }
            else if(y < (k - 1) * -chart_height){
                d3.event.transform.y = (k - 1) * -chart_height;
            }

            map.attr('transform', d3.event.transform);
        });

    svg.call(zoom);

    const tooltip = d3.select('#renderMap')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('display', 'none');

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
        const direction = d3.select(this).attr('data-zoom');

        if(direction === 'in'){
            zoom.scaleBy(svg.transition().duration(750), 2);
        }
        else if(direction === 'out'){
            zoom.scaleBy(svg.transition().duration(750), 0.5);
        }
    });

    // load files
    const files = [
        d3.json('./assets/counties-10m.json'),
        d3.csv('./assets/us-state-capitals.csv'),
        d3.csv('./assets/covid-us-counties.csv'),
    ];

    Promise.all(files.map(url => (url))).then(function(values){        
        // console.log('values: ', values);

        // find available dates for dropdown menu
        const availableDates = [];
        values[2].forEach(function(val){
            const index = availableDates.indexOf(val.date);
            if(index === -1){
                availableDates.push(val.date);
            }
        });

        // update select date dropdown menu
        availableDates.forEach(function(val){
            $('#selectDate').append(`
                <option value='${val}'>${val}</option>
            `);
        });

        // create map of dates for faster search result
        const covidDataGroupedByDateMap = d3.group(values[2], d => d.date);
        // console.log('covidDataGroupedByDateMap: ', covidDataGroupedByDateMap);

        // topojson feature converts
        const counties = topojson.feature(values[0], values[0].objects.counties).features;
        // console.log('counties: ', counties);

        color.domain([10, 100, 1000, 10000, 100000]);

        // dropdown change event
        $('#selectDate').on('change', function(){
            const filterDate = $(this).val();

            globalCurrentSelectElIndex = availableDates.findIndex(function(val){
                return val === filterDate;
            });

            // update left and right buttons
            if(globalCurrentSelectElIndex === 0){
                $('#previoudDayButton').css('opacity', 0.5).prop('disabled', true);
                $('#nextDayButton').css('opacity', 1).prop('disabled', false);
            }
            else if(globalCurrentSelectElIndex === (availableDates.length - 1)){
                $('#previoudDayButton').css('opacity', 1).prop('disabled', false);
                $('#nextDayButton').css('opacity', 0.5).prop('disabled', true);
            }
            else{
                $('#previoudDayButton').css('opacity', 1).prop('disabled', false);
                $('#nextDayButton').css('opacity', 1).prop('disabled', false);
            }

            // console.log('covidDataGroupedByDateMap.get(filterDate):', covidDataGroupedByDateMap.get(filterDate));
    
            // reset all covid cases and deaths
            counties.forEach(function(val){
                val.properties.covidCases = 0;
                val.properties.covidDeaths = 0;
            });

            // combine filtered covid data with county map data
            counties.forEach(function(county_value, county_index){
                covidDataGroupedByDateMap.get(filterDate).forEach(function(covid_value, covid_index){
                    if(covid_value.fips === county_value.id){
                        counties[county_index].properties.covidCases = covid_value.cases ? Number(covid_value.cases) : 0;
                        counties[county_index].properties.covidDeaths = covid_value.deaths ? Number(covid_value.deaths) : 0;                    
                    }
                });
            });
    
            // console.log('added corona data to counties: ', counties);

            // loading icon on svg
            $('#loadingSvg').css('display', 'flex');
            
            setTimeout(function(){
                updateCounties(counties);
            }, 100);
        });

        // keep track of current index of select el
        let globalCurrentSelectElIndex = availableDates.length - 1;

        // dropdown menu
        $('#selectDate').val(availableDates[globalCurrentSelectElIndex]).trigger('change');
        // display latest date
        $('.displayLatestDateOfData').text(availableDates[availableDates.length - 1]);
        // disable next day button
        $('#nextDayButton').css('opacity', 0.5).prop('disabled', true);

        $('#previoudDayButton').on('click', function(){
            if(globalCurrentSelectElIndex != 0){
                globalCurrentSelectElIndex --;
                $('#selectDate').val(availableDates[globalCurrentSelectElIndex]).trigger('change');
            }
        });

        $('#nextDayButton').on('click', function(){
            if(globalCurrentSelectElIndex != availableDates.length - 1){
                globalCurrentSelectElIndex ++;
                $('#selectDate').val(availableDates[globalCurrentSelectElIndex]).trigger('change');
            }
        });

        // display confirmed cases and deaths
        let totalConfirmedCasesNum = 0;
        let totalDeathsNum = 0;
        values[2].forEach(function(val){
            if(val.date === availableDates[availableDates.length - 1]){
                totalConfirmedCasesNum += Number(val.cases);
                totalDeathsNum += Number(val.deaths);
            }
        });
        // console.log('totalConfirmedCasesNum: ', totalConfirmedCasesNum);
        // console.log('totalDeathsNum: ', totalDeathsNum);

        d3.select('#confirmedCasesInUS').text(numberWithCommas(totalConfirmedCasesNum));
        d3.select('#deathsInUS').text(numberWithCommas(totalDeathsNum));

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
                })
                .attr('stroke', 'transparent')
                .attr('stroke-width', 1) 
                .on('mouseover', function(d){
                    const svgRect = document.querySelector('#renderMap').getBoundingClientRect();
                    const documentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

                    const x = d3.event.pageX - Math.round(svgRect.x);
                    const y = d3.event.pageY - Math.round(svgRect.y) - Math.round(documentScrollTop);

                    const tooltipWidth = document.querySelector('.tooltip').offsetWidth;
                    const tooltipHeight = document.querySelector('.tooltip').offsetHeight;

                    tooltip.html(`
                        <strong>${d.properties.name}</strong><br>
                        Confirmed: <span style='color: red; font-weight: bold;'>${d.properties.covidCases ? numberWithCommas(d.properties.covidCases) : 0}</span> cases<br>
                        Deaths: <span style='color: red; font-weight: bold;'>${d.properties.covidDeaths ? numberWithCommas(d.properties.covidDeaths) : 0}</span>
                    `);

                    tooltip.style('left', x - (tooltipWidth / 2) + 'px')
                        .style('top', y - (tooltipHeight + 24) + 'px');
                    
                    tooltip.transition()
                        .duration(200)
                        .style('display', 'block')
                        .style('opacity', 1)
                        .style('pointer-events', 'none');
                })
                .on('mouseout', function(d){
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0)
                        .style('display', 'none');
                });

            bindingCountyData.attr('fill', function(d){
                    const cases = d.properties.covidCases;
                    return cases ? color(cases) : '#fff';
                });

            // loading icon
            $('#loading').css('display', 'none');

            // loading icon on svg
            $('#loadingSvg').css('display', 'none');
        }
        
        // topojson feature converts
        const states = topojson.feature(values[0], values[0].objects.states).features;
        // console.log('states: ', states);

        map.selectAll('.state')
            .data(states)
            .enter()
            .append('path')
            .attr('class', 'state')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#3b3b3b')
            .attr('stroke-width', 1);

        renderTable(values[2], false);

        // show more button
        $('.showMoreButton').on('click', function(){
            // loading icon
            $('#loading').css('display', 'flex');

            setTimeout(function(){
                renderTable(values[2], true);
            }, 100);
        });

        d3.select(window).on('resize', function(){
            // get new width and height
            chart_width = $('.tabcontent').width();
            chart_height = chart_width * 0.6;

            svg.attr('width', chart_width)
                .attr('height', chart_height)

            map.select('rect')
                .attr('width', chart_width)
                .attr('height', chart_height);

            // update projection
            projection
                .translate([chart_width / 2, chart_height / 2])
                .scale(chart_width);

            svg.selectAll('.county')
                // .transition()
                .attr('d', path);

            svg.selectAll('.state')
                // .transition()
                .attr('d', path);
        });
    });

    function numberWithCommas(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function renderTable(data, renderAllRows){
        const latestDate = data[data.length - 1].date.split('-').join('');

        let filteredData = data.filter(function(val){
            return val.date.split('-').join('') === latestDate;
        });
        
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
            $('.whiteGradientImg').hide();
        }

        // loading icon
        $('#loading').css('display', 'none');
    }
});