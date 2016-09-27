// Tonia Roddick 2014
dojo.require("esri.map");
dojo.require("esri.dijit.Popup")
dojo.require("esri.dijit.Legend");
dojo.require("esri.dijit.BasemapGallery");
dojo.require("esri.arcgis.utils");
dojo.require("esri.virtualearth.VETiledLayer");
dojo.require("esri.tasks.locator");
dojo.require("esri.graphic");
dojo.require("esri.tasks.query");
dojo.require("esri.tasks.identify");
dojo.require("esri.tasks.PrintTask");
dojo.require("esri.tasks.PrintParameters");
dojo.require("esri.tasks.PrintTemplate");
dojo.require("esri.utils");
dojo.require("esri.symbol");
dojo.require("esri.symbols.SimpleLineSymbol");
dojo.require("esri.geometry.webMercatorUtils");
dojo.require("esri.layers.MapImage"); 
dojo.require("esri.layers.ImageParameters");

//dojo.require("dojox.grid.DataGrid");
//dojo.require("dojo.data.ItemFileReadStore");

dojo.require("dijit.TitlePane");
dojo.require("dijit.Tooltip");
dojo.require("dijit.Toolbar");
dojo.require("dijit.Menu");
dojo.require("dijit.TooltipDialog");

dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");

dojo.require("dijit.form.CheckBox");
dojo.require("dijit.form.Button");
dojo.require("dijit.form.ComboBox");
dojo.require("dijit.form.DropDownButton");
dojo.require("dijit.form.FilteringSelect");
dojo.require("dijit.layout.TabContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("dijit.Dialog");

dojo.require("wim.ExtentNav");
dojo.require("wim.LatLngScale");
dojo.require("wim.CollapsingContainer");
dojo.require("modules.ParamSelector");

      
var map, legendLayers = [];
var identifyTask, identifyParams;
var navToolbar;
var locator;
var aiStore;
var prodStore;
var layerDefinitions = [];
var formatDate = "0";
//extents to be used when showing polygons within zoomed in area
var XMIN;
var YMIN;
var XMAX;
var YMAX;
var searchExtent;
var pulaSelected = false;
var zoomMapImageURL;
var whichPDF;

function init() {
	
	//point to proxy
	//esri.config.defaults.io.proxyUrl = "../BLTPublic_Proxies/proxy.ashx";	
	//esri.config.defaults.io.alwaysUseProxy = true;
   
	//disable Results tab until they click on a polygon
	/*$("#tabs").tabs({
		activate: function(event,ui){
			checkIfShapeSelected();
		}
	});*/

	
	
	map = new esri.Map("map", {
    	basemap: "topo",
		wrapAround180: true, //xmin:-11420303.522028634,ymin:3387689.093598152,xmax:-6939259.175839653,ymax:6114962.262812516,
		extent: new esri.geometry.Extent({xmin:-14881296.05,ymin:1145638.02,xmax:-6075750.39,ymax:7016001.79,spatialReference:{wkid:102100}}), 
		slider: true,
		logo:false,
		//infoWindow: popup
	});
	//event handler for when map is zoomed
	dojo.connect(map, "onExtentChange", getExtent);

    navToolbar = new esri.toolbars.Navigation(map);
	
    dojo.connect(map, "onLoad", mapReady);
	
	var basemapGallery = new esri.dijit.BasemapGallery({
		showArcGISBasemaps: true,
		map: map
	}, "basemapGallery");
	basemapGallery.startup();
	
	dojo.connect(basemapGallery, "onError", function() {console.log("Basemap gallery failed")});

	dojo.connect(map, "onClick", executeMapClickTask);
	//http://107.20.182.222/arcgis/rest/services/BLT/BLT_PULAsRelated/MapServer
	pulaLayer = new esri.layers.ArcGISDynamicMapServiceLayer("http://bltdev.wim.usgs.gov/arcgis/rest/services/BLT/BLT_PULAsRelated/MapServer", { "visible": true, "opacity": 0.5 });
	pulaLayer.setVisibleLayers([3]);
	
	legendLayers.push({layer: pulaLayer, title: "Pesticide Use Limitation Area (PULA)"});

	var d = new Date();
	var formatDate = dojo.date.locale.format(d, { datePattern: "yyyy-MM-dd", selector: "date" });
	var monthYear = dojo.date.locale.format(d, { datePattern: "yyyy-MM", selector: "date" });
	
	//layerDefinition to only show effective for public
	layerDefinitions[3] = "published_time_stamp IS NOT NULL AND effective_date <= DATE '" + formatDate + "' AND ((expired_time_stamp >= DATE '" + monthYear + "') OR (expired_time_stamp IS NULL))";
	pulaLayer.setLayerDefinitions(layerDefinitions);
	//pulaLayer.setVisibility(true);
	
	/////////////// Request and Dropdown Populating for ACTIVE INGREDIENT ////////////////////////////////
    Date.prototype.today = function () {
	    return (this.getMonth() + 1) + "/" + this.getDate() + "/" + this.getFullYear()
	};
	var newDate = new Date();
	var datetime = newDate.today();
	//I can get the data back if i add the proxy, but then it comes back as xml. if i take it off, i don't get it at all. need json.
	
    $.ajax({
    	dataType: 'json',
        type: 'Get',
        url: '../BLTServices/ActiveIngredients.json?publishedDate=' + datetime,
        headers:{
        	'Accept': '*/*'		
        },
        success: function(data){
        	if (data.length>0){
				$('#AISelectInput').append($('<option></option>').val(0).html("All"));
            	$.each(data, function(){
					if (this['ingredient_name'].length > 30)
					{
						$('#AISelectInput').append($('<option></option>').val(this['active_ingredient_id']).html(this['ingredient_name'].substring(0,30)).attr('title', this['ingredient_name']));
					}
					else 
					{
						$('#AISelectInput').append($('<option></option>').val(this['active_ingredient_id']).html(this['ingredient_name']));
					}
				});
			}
		}, 
		error: function(xhr) {
			var error;	
		}
	});
	/////////////// Request and Dropdown Populating for ACTIVE INGREDIENT ////////////////////////////////
    
	
	////////////// populate Application Month dropdown with current + 6 months //////////////////////////
	var appMonthYrSelect = document.getElementById("AppMonthYr");
	
	//month year dropdown, current view text and results tab effective date text
	appMonthYrSelect.options[0] = new Option(Date.today().toString('MMMM yyyy'));
	for (a = 1; a <= 6; a++) {
		appMonthYrSelect.options[a] = new Option((Date.today().addMonths(a).toString('MMMM yyyy')));
	}

	document.getElementById("currentView").innerHTML = Date.today().toString('MMMM yyyy');
	document.getElementById("EffectiveDate").innerHTML = Date.today().toString('MMMM yyyy');

	////////////// populate Application Month dropdown with current + 6 months //////////////////////////
	
	//////////////////// Product dropdown autocomplete ////////////////////////////////
	
		//handled in the index.html page

	//////////////////// Product dropdown autocomplete ////////////////////////////////

	map.addLayers([pulaLayer]);
	
	//this function creates the legend element based on the legendLayers array which contains the relevant data for each layer. 
	dojo.connect(map,'onLayersAddResult',function(results){
		var legend = new esri.dijit.Legend({
			map:map,
			layerInfos:legendLayers
		},"legendDiv");
		legend.startup();
		
		//this forEach loop generates the checkbox toggles for each layer by looping through the legendLayers array (same way the legend element is generated). 
		dojo.forEach (legendLayers, function(layer){
			var layerName = layer.title;
			var checkBox = new dijit.form.CheckBox({
				name:"checkBox" + layer.layer.id,
				value:layer.layer.id,
				checked:layer.layer.visible,
				onChange:function(evt){
					var checkLayer = map.getLayer(this.value);
					checkLayer.setVisibility(!checkLayer.visible);
					this.checked = checkLayer.visible;						
				}
			});
			if (layer.zoomScale) {
				//create the holder for the checkbox and zoom icon
				var toggleDiv = dojo.doc.createElement("div");
				dojo.place(toggleDiv,dojo.byId("toggle"),"after");
				dojo.place(checkBox.domNode,toggleDiv,"first");
				var checkLabel = dojo.create('label',{'for':checkBox.name,innerHTML:layerName},checkBox.domNode,"after");
				var scale = layer.zoomScale;
				var zoomImage = dojo.doc.createElement("div");
				zoomImage.id = 'zoom' + layer.layer.id;
				zoomImage.innerHTML = '<img id="zoomImage" style="height: 18px;width: 18px" src="images/zoom.gif" />';
				dojo.connect(zoomImage, "click", function() {
					if (map.getScale() > scale) {
						map.setScale(scale);;
					}
				});
				dojo.place(zoomImage,toggleDiv,"last");
				dojo.setStyle(checkBox.domNode, "float", "left");
				dojo.setStyle(checkLabel, "float", "left");
				dojo.setStyle(toggleDiv, "paddingTop", "5px");
				dojo.setStyle(dojo.byId("zoomImage"), "paddingLeft", "10px");
				dojo.setStyle(toggleDiv, "height", "25px");
				//dojo.byId("toggle").appendChild(zoomImage);
				//dojo.appendChild(zoomImage.domNode,dojo.byId("toggle"),"after");
				
				dojo.place("<br/>",zoomImage,"after");
			} else {
				dojo.place(checkBox.domNode,dojo.byId("toggle"),"after");
				var checkLabel = dojo.create('label',{'for':checkBox.name,innerHTML:layerName},checkBox.domNode,"after");
				dojo.place("<br/>",checkLabel,"after");
			}
		}); //end dojo.foreach
    }); //end dojo.connect

	var searchDate = $("#currentView").text();
   	var thisSDate = FormatThisDate(searchDate);

   	Date.prototype.yyyymmdd = function() {
   		var yyyy = this.getFullYear().toString();
   		var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
   		var dd  = this.getDate().toString();
   		return yyyy + "-" + (mm[1]?mm:"0"+mm[0]) + "-" + (dd[1]?dd:"0"+dd[0]); // padding
  	};

	d = new Date(thisSDate);
	var formatDate = d.yyyymmdd();

	identifyTask = new esri.tasks.IdentifyTask("http://bltdev.wim.usgs.gov/arcgis/rest/services/BLT/BLT_PULAsRelated/MapServer");
    //identifyTask.where = "EFFECTIVE_DATE IS NOT NULL";// AND EFFECTIVE_DATE >= DATE '" + formatDate + "'";
	identifyParams = new esri.tasks.IdentifyParameters();
    identifyParams.tolerance = 5;
    identifyParams.returnGeometry = true;
    identifyParams.layerIds = [3];
    identifyParams.layerOption = esri.tasks.IdentifyParameters.LAYER_OPTION_VISIBLE;
    identifyParams.width  = map.width;
    identifyParams.height = map.height;

    function executeMapClickTask(evt) {
    	
        map.graphics.clear();
        pulaSelected = false;
        dijit.byId("tabTwo").set('disabled', true);
        var tabs = dijit.byId("tabs"); 
        tabs.selectChild("tabOne");

        identifyParams.geometry = evt.mapPoint;
        identifyParams.mapExtent = map.extent;
        
        var deferred = identifyTask.execute(identifyParams);

        deferred.addCallback(function(response) {     
            // response is an array of identify result objects    
            // Let's return an array of features.
           	return dojo.map(response, function(result) {
				$("#loading").fadeIn();
               	var feature = result.feature;
               	feature.attributes.layerName = result.layerName;
                if (feature.attributes.layerName == "Effective" && feature.attributes.effective_date != "Null")
                {
                	var searchDate = $("#currentView").text();
                	var dateToPass = FormatThisDate(searchDate);
                	var thisSDate = new Date(FormatThisDate(searchDate));
                	effectiveDate = new Date(feature.attributes.effective_date);
                	if (effectiveDate <= thisSDate) {
                		var thisPULAID = feature.attributes.pula_id;
	               		var thisPULASHPID = feature.attributes.PULASHAPEI;
					
						//highlight selected 
	                	var highlightSymbol = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_SOLID, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255,255,255,0.35]), 1),new dojo.Color([125,125,125,0.35]));
	                	var myPolygon = {"geometry":{"rings":feature.geometry.rings,"spatialReference":102100},
							"symbol":{"color":[0,0,0,0],"outline":{"color":[255,255,0,255],  "width":2,"type":"esriSLS","style":"esriSLSSolid"},
							"type":"esriSFS","style":"esriSFSSolid"}};
						var gra = new esri.Graphic(myPolygon);
	                    
	                	map.graphics.add(gra);
	                    pulaSelected = true;

	               		//now call the services to get back all the limitations
	               		$.ajax({
				    		dataType: 'json',
				        	type: 'Get',
				    	    url: '../BLTServices/PULAs/' + thisPULAID + '/LimitationsForMapper.json?ShapeID=' + thisPULASHPID + '&EffectDate=' + dateToPass,
				        	headers:{
				    	    	'Accept': '*/*'		
					        },
					        success: function(data){
					        	if (data.MapperLimits.length>0){
					        		$("#EffectiveDate").text(searchDate);
					        		//first clear tbody
					     	   		$("#ResultsTable tbody").html("");
				        			$("#CodeTable tbody").html("");
				        		
				        			//store each Limit code to loop through later and get unique
				        			var codes = [];
				    	    		var limits = [];
					        		var AIvalue = $("#AISelectInput option:selected").text();
					        		var PRvalue = $("#prods").val();
					        		if (PRvalue != "") {
					        			//var charIndex = PRvalue.indexOf("[");
					        			//PRvalue = PRvalue.substring(0, charIndex-1);
									}
									else {
										PRvalue = $("#prodReg").val();
										//var charIndex = PRvalue.indexOf("[");
										//PRvalue = PRvalue.substring(0, charIndex-1);
									}
									for(i=0; i < data.MapperLimits.length; i++) {
										if (AIvalue != "All" && AIvalue != null) {
											//only show limitation for the AI they chose
											if (data.MapperLimits[i].NAME.toUpperCase() == AIvalue.toUpperCase()){
												var properName = data.MapperLimits[i].NAME;
												$('#ResultsTable tbody').append('<tr><td style="border:#E7E4CE solid 1px;padding:4px">' +
													properName + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
													data.MapperLimits[i]["USE"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
													data.MapperLimits[i]["APPMETHOD"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
													data.MapperLimits[i]["FORM"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
													data.MapperLimits[i].LIMIT.code + '</td></tr>'
												);		
											}
										}
										else if (PRvalue != "0" && PRvalue != "") {
											//only show limitation for the Product they chose
											if (data.MapperLimits[i].NAME == PRvalue){
												var properName = data.MapperLimits[i].NAME;
												$('#ResultsTable tbody').append('<tr><td style="border:#E7E4CE solid 1px;padding:4px">' +
													properName + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
													data.MapperLimits[i]["USE"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
													data.MapperLimits[i]["APPMETHOD"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
													data.MapperLimits[i]["FORM"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
													data.MapperLimits[i].LIMIT.code + '</td></tr>'
												);		
											}	
										}
										else {
											//show all limitations
											var properName = data.MapperLimits[i].NAME;
											$('#ResultsTable tbody').append('<tr><td style="border:#E7E4CE solid 1px;padding:4px">' +
												properName + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
												data.MapperLimits[i]["USE"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
												data.MapperLimits[i]["APPMETHOD"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
												data.MapperLimits[i]["FORM"] + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' +
												data.MapperLimits[i].LIMIT.code + '</td></tr>'
											);
										}	
										if ($.inArray(data.MapperLimits[i].LIMIT.code, codes) == -1)
										{
											//only add them for the ai/prod they chose (if its in the above table)
											$('#ResultsTable tr').each(function() {
												var v = $(this).find("td:last").text();
												if (v == data.MapperLimits[i].LIMIT.code) {
													codes.push(data.MapperLimits[i].LIMIT.code);
													limits.push(data.MapperLimits[i].LIMIT);
												}
											});
										}

									};
										
									for(i=0; i < limits.length; i++) {
										$('#CodeTable tbody').append('<tr><td style="border:#E7E4CE solid 1px;padding:4px">' + limits[i].code + '</td><td style="border:#E7E4CE solid 1px;padding:4px">' + limits[i].limitation1 + '</td></tr>')
									};
								}

								//set active tab to be results
								var tabs = dijit.byId("tabs"); 
								var cp = tabs.selectedChildWidget.id; 
								if (cp == "tabOne"){
									tabs.selectChild("tabTwo");
								}
								if (pulaSelected)	
									dijit.byId("tabTwo").set('disabled', false);
								$("#loading").fadeOut();
							}, 
							error: function(xhr) {
								var error;	
							}
						});
					}
					else {
						pulaSelected = false;
						var tabs = dijit.byId("tabs"); 
						tabs.selectChild("tabTwo");
						dijit.byId("tabTwo").set('disabled', false);
					}
                }
                	
            });
        });
		
    }

    //Geocoder Reference in init function
    locator = new esri.tasks.Locator("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
    dojo.connect(locator, "onAddressToLocationsComplete", showGeoCodeResults);

	dijit.byId("tabTwo").set('disabled', true);

    //start the splash screen
    //introJs().start();

}//end init

//convert all upper case product names to proper (titlecase) names
function toProperCase(str) {
	var noCaps = ['of','a','the','and','an','am','or','nor','but','is','if','then', 
		'else','when','at','from','by','on','off','for','in','out','to','into','with'];
    return str.replace(/\w\S*/g, function(txt, offset){
       	if(offset != 0 && noCaps.indexOf(txt.toLowerCase()) != -1){
       	   return txt.toLowerCase();    
       	}
       return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

//when user clicks tab, see if a shape is selected to determine if Results should be enabled or disabled
function checkIfShapeSelected() {
	if (pulaSelected) {
		dijit.byId("tabTwo").set('disabled', true);
	}
	else {
		dijit.byId("tabTwo").set('disabled', false);
	}

}

function getExtent(extent){
	XMIN = extent.xmin;
	YMIN = extent.ymin;
	XMAX = extent.xmax;
	YMAX = extent.ymax;

	searchExtent = new esri.geometry.Extent({xmin:XMIN,ymin:YMIN,xmax:XMAX,ymax:YMAX,spatialReference:{wkid:102100}});
}

function FormatThisDate(searchDate) {
	var i = searchDate.indexOf(" ");
	var monthName = searchDate.substring(0, i);
	var monthNum = new Date(Date.parse(monthName + " 1, 2012")).getMonth()+1;
	var y = searchDate.substring(i+1);
	var fullDate = monthNum + "/01/" + y.trim();//.substring(1);
	
	return fullDate;
}

//filters chosen to display polygons by application month/yr, &/or AI &/or Product
function SubmitClick() {
	 //loading...
    $("#loading").fadeIn();
	
	//get values chosen
	var d = document.getElementById('AppMonthYr').value;
	document.getElementById("currentView").innerHTML = 	d;
	document.getElementById("EffectiveDate").innerHTML = 	d;

	//clear results tables
	$("#ResultsTable tbody").html("");
   	$("#CodeTable tbody").html("");
	
	if (d == "- Choose Application Month -") {
		alert("Please Choose an Application Date first");
		exit();
	}
	else {
		var monthEnd = d.indexOf(" ");
		var month = d.substring(0, monthEnd);
		var year = d.substring(monthEnd + 1);
		formatDate = month + "/01/" + year;	
	}
	
	var a = document.getElementById('AISelectInput').value;
	if (a == "")
		a = "0";
		
	//could  be product name or Product registration number entered
	var p = document.getElementById('hiddenProdID').value; 
	var pr = document.getElementById('hiddenProdRegID').value;
	if (p == "" && pr == "") {
		p = "0";
	}
	//if pr has value, they entered in reg number, use that
	if (pr >= 1) {
		p = pr;
	}
		
	if (formatDate == "0" && a == "0" && p == "0") 
		alert("Please choose at least the Application Month before clicking Search");
		
	//clear layer definition
	layerDefinitions[3] = "";

	//get effective pulas that match filters
	var returningPULAs;
	$.ajax({
    	dataType: 'json',
        type: 'Get',
        url: '../BLTServices/PULAs/FilteredSimplePULAs.json?date=' + formatDate + '&aiID=' + a + '&productID=' + p,
        headers:{
        	'Accept': '*/*'
        },
        success: function(data){
			var layerDefs = "";
        	if (data['PULA'].length>0){			
				$.each(data['PULA'], function(index) {
					layerDefs += "PULASHAPEI = " + data['PULA'][index].ShapeID + " OR ";
				});

				//remove trailing 'or'
				layerDefinitions[3] = layerDefs.slice(0, -4);
				pulaLayer.setLayerDefinitions(layerDefinitions);
				
				//new query to pass to test if return is within the current map extent
				var newQuery = new esri.tasks.Query();
				newQuery.where = layerDefs.slice(0, -4);
				newQuery.geometry = map.extent;
				newQuery.returnGeometry = false; 
				var newQueryTask = new esri.tasks.QueryTask(pulaLayer.url + "/3");
				newQueryTask.executeForCount(newQuery, function(count) {
					if (count == 0){
						//there are no limitations within the map extent returned. show popup with print pdf
						$('div#dialog-confirm').dialog('open');
					}
				},function(error){
  					console.log(error);
  				});				
			}
			else {
				//alert("No PULAs were found with these parameters");
				$('div#dialog-confirm').dialog('open');
				//clear filters
				ClearClick();
			}
		}, 
		error: function(xhr) {
			var error;	
		}
	});
	$("#loading").fadeOut();
}

//AI chosen, clear Product choice
function AIChanged() {
	$("#prods").val("");
	$("#hiddenProdID").val("");
	$("#prodReg").val("");
	$("#hiddenProdRegID").val("");
}

//no limitations exist within map extent, print PDF that states so
function LimitationsPDF(existingLimit) {
	$("#loading").fadeIn();

	whichPDF = existingLimit;

	//var PTurl = "http://107.20.182.222/arcgis/rest/services/BLT/PrintMapService/GPServer/Export%20Web%20Map";
	var PTurl = "http://bltdev.wim.usgs.gov/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task";
	var pt = new esri.tasks.PrintTask(PTurl);
	
	var params = new esri.tasks.PrintParameters();
	var template = new esri.tasks.PrintTemplate();

	params.map = map;
	template.exportOptions = {
		width: 400,
		height: 425,
		dpi: 72
	};
	

	template.format = "jpg";
	template.layout_template = "MAP_ONLY";
	template.preserveScale = false;	
	template.showAttribution = false;

	params.template = template;

	pt.execute(params, PrintResult);
}
	
function PrintResult(result) {
	
	var resultURL = result.url;

	//get map image on canvas
	var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    var img = document.createElement('img');
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = resultURL; 
	
	img.onload = function() {
		canvas.height = img.height;
    	canvas.width = img.width;
    
    	ctx.drawImage(img, 0, 0);
    
    	var dataURL = canvas.toDataURL('image/jpeg');
    
    	canvas = null; 

	    var imgFromUrl = dataURL;
		
		
		//Try creating an html page first, then send the whole thing to PDF///////////
		//var temp = document.getElementById("PDFTemp");
		
		//temp.appendChild(document.getElementById("tabTwo"));
		//window.open('PDF_Template.html');
	

		//Try creating an html page first, then send the whole thing to PDF///////////
		
		var doc = new jsPDF('p','pt','a4', true);
		

		//so I guess we'll try jpg
		//epa_seal_large_gray.jpg
		var epa_watermark = getEPAWaterMarkString();
		
		//epafiles_logo_epaseal.jpg
		var epaLogo = getEPALogo();	

		doc.addImage(epa_watermark, 'jpg', 	170, 28, 283, 283);
		doc.addImage(epa_watermark, 'jpg', 	170, 567, 283, 283);

		//title background
		doc.setFillColor(243, 122, 73);
		doc.rect(14, 11, 567, 34, 'F');

		//title
		doc.setTextColor(231, 228, 206);
		doc.setFontSize(26);
		doc.setFontType("bold");
		doc.text(34, 37, 'Endangered Species Protection Bulletin');
		
		//container box (every page)
		doc.setDrawColor(51,102,153);
		doc.setLineWidth(2);
		doc.rect(14, 57, 567, 737);

		//epa logo in upper corner
		doc.addImage(epaLogo, 'PNG', 28, 70, 85, 85);
		
		//Valid info	
		var validFor = "Valid For: " + $("#currentView").text();	
		doc.setTextColor(243, 122, 73);
		doc.setFontSize(16);
		doc.text(142, 124, validFor);

		//Info 1
		doc.setFontSize(20);
		doc.setTextColor(0, 0, 0);
		doc.text(34, 186, '1');
		
		doc.setFontSize(12);
		doc.setFontType("normal");
		var step1 = 'Areas where pesticide use must be limited are identified on the map. A legend is located below the map to help pinpoint these locations.';
		var step1Split = doc.splitTextToSize(step1, 454);
		doc.text(57, 179, step1Split);
		
		//add screenshot of map
		doc.addImage(imgFromUrl, 'jpg', 57, 201, 425, 400);
		
		//legend swath
		doc.setDrawColor(0);
		doc.setLineWidth(0.5);
		doc.setFillColor(255, 204, 204);
		doc.rect(57, 605, 28, 14, 'FD');

		doc.setTextColor(0);
		doc.setFontSize(12);
		doc.text(94, 615, 'Limitation Area');

		if (whichPDF == "None") {
			doc.setFontSize(12);
			doc.setFontType("normal");
			var stepsPt1 = 'Currently, no pesticide use limitations exist within the printed map view for the month and year you selected, beyond the instructions specified on the pesticide label. Follow the use instructions on your label.';
			var stepsPt1Split = doc.splitTextToSize(stepsPt1, 454);
			doc.text(57, 645, stepsPt1Split);

			var stepsPt2 = 'Ensure that your pesticide application area is within the printed map view. If it is not, follow the directions on the Instructions Tab to ensure that your pesticide application area is captured within the printed map view.';
			var stepsPt2Split = doc.splitTextToSize(stepsPt2, 454);
			doc.text(57, 695, stepsPt2Split);

			var stepsPt3 = 'Please check back if you plan to apply your pesticide in an area outside the map view or in a month and year other than the one for which this Bulletin is valid.';
			var stepsPt3Split = doc.splitTextToSize(stepsPt3, 454);
			doc.text(57, 745, stepsPt3Split);

			//legal stuff (every page)
			var legalS1 = "This document contains legal requirements for the use of certain pesticides."
			var legalS2 = "Do not modify any text, graphics or coloration or otherwise alter this document."
			var contact1 = "ESPP Contact: ESPP@epa.gov   Phone: 1-800-447-3813"
			doc.setFontSize(8);
			doc.setFontType("bold");
			doc.text(142, 808, legalS1);
			doc.text(136, 819, legalS2);
			doc.text(176, 830, contact1);


			// Save the PDF
			var fileName = 'LimitationFor' + $("#currentView").text() + '.pdf';
			doc.save(fileName);
		}
		else {
			//Info 2:
			doc.setFontSize(20);	
			doc.setFontType("bold");
			doc.setTextColor(0, 0, 0);
			doc.text(34, 647, '2');
			
			doc.setFontSize(12);
			doc.setFontType("normal");
			var stepsPt1 = 'Look below at the Pesticide Use Limitation Summary Table. This table lists the user selected Active Ingredient(s) (ALs) or Product(s) with pesticide use limitations on the printed map. Locate the Active Ingredient (AI) or Product you intend to apply in this table and identify the code in the last column. This code indicates the specific limitation associated with that AI or Product. A limitation description for each code can be found below in the Codes and Limitations Table. If multiple Pesticide Use Limitation Areas (PULAs) are visible on the map, these tables provide information for the highlighted PULA.';
			var stepsPt1Split = doc.splitTextToSize(stepsPt1, 454);
			doc.text(57, 640, stepsPt1Split);

			var stepsPt2 = 'If you are applying a pesticide that contains more than one Active Ingredient, or multiple Products, then multiple codes may apply. Follow the limitations for all codes when using this pesticide.';
			var stepsPt2Split = doc.splitTextToSize(stepsPt2, 454);
			doc.text(57, 752, stepsPt2Split);
		
			//legal stuff (every page)
			var legalS1 = "This document contains legal requirements for the use of certain pesticides."
			var legalS2 = "Do not modify any text, graphics or coloration or otherwise alter this document."
			var contact1 = "ESPP Contact: ESPP@epa.gov   Phone: 1-800-447-3813"
			doc.setFontSize(8);
			doc.setFontType("bold");
			doc.text(142, 808, legalS1);
			doc.text(136, 819, legalS2);
			doc.text(176, 830, contact1);


			doc.addPage();
			
			//---------------------------------------------------------------------------------------//
				
			doc.addImage(epa_watermark, 'jpg', 	170, 28, 283, 283);
			doc.addImage(epa_watermark, 'jpg', 	170, 567, 283, 283);

			//container box (every page)
			doc.setDrawColor(51,102,153);
			doc.setLineWidth(2);
			doc.rect(14, 57, 567, 737);

/////////////////// Start  Limitation Table Area  ////////////////////////////////////////////////////////

			//Limitation Table Label
			doc.setFontSize(20);
			doc.setFontType("bold");
			doc.text(25, 85, 'Pesticide Use Limitation Summary Table');

			var specialElementHandlers = {
            	'#bypassme': function (element, renderer) {
            		return true;
        		}
    		};
			
			
			doc.setFontType("normal");
			doc.setFontSize(12);
			
			//table border
			doc.setDrawColor(158,153,153);
			doc.setLineWidth(1);

		
			var ResultTbl = 
		        tableToJson($('#ResultsTable').get(0)),
		        cellWidth = 70,
		        rowCount = 0,
		        cellContents,
		        leftMargin = 25,
		        topMargin = 96,
		        topMarginTable = 55,
		        headerRowHeight = 15,
		        rowHeight = 12;

 			
 			doc.cellInitialize();

			doc.margins = 1;
        	doc.setFontSize(9);
        	doc.setFontType("bold");
        	doc.cell(leftMargin, topMargin, 210, headerRowHeight, "AI/Product", 0);
	        doc.cell(leftMargin, topMargin, 100, headerRowHeight, "Use", 0);
	        doc.cell(leftMargin, topMargin, 110, headerRowHeight, "App Method", 0);
	        doc.cell(leftMargin, topMargin, 90, headerRowHeight, "Formulation", 0);
	        doc.cell(leftMargin, topMargin, 30, headerRowHeight, "Code", 0);
		   
		    var AISplit = [];
			var UseSplit = [];
			var AppSplit = [];
			var FormSplit = [];
			var CodeSplit = [];

		    $.each(ResultTbl, function (i, row)
	    	{   
		        $.each(row, function (j, cellContent) {
	        		if (j == "AI/Product"){
	        			var ai = doc.splitTextToSize(cellContent, 201);
	        			AISplit.push(ai.length);
		            }
		            else if (j == "Use"){
		            	var us = doc.splitTextToSize(cellContent, 100);
	        			UseSplit.push(us.length);
		            }
		            else if (j == "App Method"){
			            var app = doc.splitTextToSize(cellContent, 110);
	        			AppSplit.push(app.length);
		            }
		            else if (j == "Formulation"){
		            	var form = doc.splitTextToSize(cellContent, 90);
	        			FormSplit.push(form.length);
		            }
		            
		        });
		    });

		    //keep track of the rowHeight so we know where to put the next table
		    var totalRowCount = 0;
		   $.each(ResultTbl, function (i, row)
	    	{   
	    		//first get the highest number from this index
	    		var highestNum = Math.max(AISplit[i], UseSplit[i], AppSplit[i], FormSplit[i])
				//then use a switch case to assign rowheight
	    		switch(highestNum) {
	    			case 8:
				        headerRowHeight = 65;
				        totalRowCount += headerRowHeight;
				        break;
	    			case 7:
				        headerRowHeight = 60;
				        totalRowCount += headerRowHeight;
				        break;
	    			case 6:
				        headerRowHeight = 55;
				        totalRowCount += headerRowHeight;
				        break;
				    case 5:
				        headerRowHeight = 50;
				        totalRowCount += headerRowHeigh
				        t;
				        break;
				    case 4:
				        headerRowHeight = 40;
				        totalRowCount += headerRowHeight;
				        break;
			        case 3:
			        	headerRowHeight = 35;
				        totalRowCount += headerRowHeight;
			        	break;
			        case 2:
			        	headerRowHeight = 25;
				        totalRowCount += headerRowHeight;
			        	break;
				    default:
				        headerRowHeight = 15;
				        totalRowCount += headerRowHeight;
				}

	    		i++;
	        	rowCount++;
		        
		        $.each(row, function (j, cellContent) {

		        	doc.margins = 1;
	        		doc.setFontSize(8);
	        		doc.setFontType("normal");
	        		if (j == "AI/Product"){
	        			var splitAI = doc.splitTextToSize(cellContent, 201);
	        			doc.cell(leftMargin, topMargin, 210, headerRowHeight, splitAI, i);
		            }
		            else if (j == "Use"){
		            	var splitUse = doc.splitTextToSize(cellContent, 100);
		            	doc.cell(leftMargin, topMargin, 100, headerRowHeight, splitUse, i);
		            }
		            else if (j == "App Method"){
		            	var splitApp = doc.splitTextToSize(cellContent, 110);
		            	doc.cell(leftMargin, topMargin, 110, headerRowHeight, splitApp, i);
		            }
		            else if (j == "Formulation"){
		            	var splitForm = doc.splitTextToSize(cellContent, 90);
		            	doc.cell(leftMargin, topMargin, 90, headerRowHeight, splitForm, i);
		            }
		            else if (j == "Code"){
		            	doc.cell(leftMargin, topMargin, 30, headerRowHeight, cellContent, i);
		            }					
		        });
		    });
			
/////////////////// END  Limitation Table Area ////////////////////////////////////////////////////////


/////////////////// START  Codes Table Area ////////////////////////////////////////////////////////

			//add on to the totalRowCount to include pesticide table heading and starting place
			// += header row for Pest table + Pesticide label + from top to start of Pesticide Label + added space between pest table and this label
			totalRowCount += 15 + 30 + 85 + 20;

			//code table
			doc.setFontSize(20);
			doc.setFontType("bold");
			doc.text(25, totalRowCount, 'Codes and Limitations Table');

			//table
			doc.setFontType("normal");
			doc.setFontSize(10);

			var CodeTbl = 
		        tableToJson($('#CodeTable').get(0)),
		        cellWidth = 70,
		        rowCount = 0,
		        cellContents,
		        leftMargin = 25,
		        topMargin = totalRowCount + 11,
		        topMarginTable = 55,
		        headerRowHeight = 15,
		        rowHeight = 12;

 			
 			doc.cellInitialize();

		    doc.margins = 1;
        	doc.setFontSize(9);
        	doc.setFontType("bold");
        	doc.cell(leftMargin, topMargin, 35, headerRowHeight, "Code", 0);
	        doc.cell(leftMargin, topMargin, 500, headerRowHeight, "Limitation", 0);
		   
		    var LimitationSplit = [];
			
		    $.each(CodeTbl, function (i, row)
	    	{   
		        $.each(row, function (j, cellContent) {
	        		if (j == "Limitation"){
	        			var li = doc.splitTextToSize(cellContent.trim(), 490);
	        			LimitationSplit.push(li.length);
		            }
		            
		        });
		    });

		    //keep track of the rowHeight so we know where to put the next table
		    var totalCodeRowCount = 0;
		   $.each(CodeTbl, function (i, row)
	    	{   
	    		//first get the highest number from this index
	    		var highestNum = LimitationSplit[i];
				//then use a switch case to assign rowheight
	    		switch(highestNum) {
	    			case 14:
				        headerRowHeight = 115;
				        totalCodeRowCount += headerRowHeight;
				        break;
	    			case 13:
				        headerRowHeight = 115;
				        totalCodeRowCount += headerRowHeight;
				        break;
	    			case 12:
				        headerRowHeight = 100;
				        totalCodeRowCount += headerRowHeight;
				        break;
	    			case 11:
				        headerRowHeight = 100;
				        totalCodeRowCount += headerRowHeight;
				        break;
	    			case 10:
				        headerRowHeight = 100;
				        totalCodeRowCount += headerRowHeight;
				        break;
				    case 9:
				        headerRowHeight = 100;
				        totalCodeRowCount += headerRowHeight;
				        break;
					case 8:
				        headerRowHeight = 75;
				        totalCodeRowCount += headerRowHeight;
				        break;
	    			case 7:
				        headerRowHeight = 60;
				        totalCodeRowCount += headerRowHeight;
				        break;
	    			case 6:
				        headerRowHeight = 55;
				        totalCodeRowCount += headerRowHeight;
				        break;
				    case 5:
				        headerRowHeight = 50;
				        totalCodeRowCount += headerRowHeight;				        
				        break;
				    case 4:
				        headerRowHeight = 40;
				        totalCodeRowCount += headerRowHeight;
				        break;
			        case 3:
			        	headerRowHeight = 35;
				        totalCodeRowCount += headerRowHeight;
			        	break;
			        case 2:
			        	headerRowHeight = 25;
				        totalCodeRowCount += headerRowHeight;
			        	break;
				    default:
				        headerRowHeight = 15;
				        totalCodeRowCount += headerRowHeight;
				}

	    		i++;
	        	rowCount++;
		        
		        $.each(row, function (j, cellContent) {

		        	doc.margins = 1;
	        		doc.setFontSize(8);
	        		doc.setFontType("normal");
	        		if (j == "Code"){
	        			doc.cell(leftMargin, topMargin, 35, headerRowHeight, cellContent, i);
		            }
		            else if (j == "Limitation"){
		            	var splitLimit = doc.splitTextToSize(cellContent, 490);
		            	doc.cell(leftMargin, topMargin, 500, headerRowHeight, splitLimit, i);
		            }
		        });
		    });
			

/////////////////// END  Codes Table Area ////////////////////////////////////////////////////////

			//legal stuff (every page)
			var legalS1 = "This document contains legal requirements for the use of certain pesticides."
			var legalS2 = "Do not modify any text, graphics or coloration or otherwise alter this document."
			var contact1 = "ESPP Contact: ESPP@epa.gov   Phone: 1-800-447-3813"
			doc.setFontSize(8);
			doc.setFontType("bold");
			doc.text(142, 808, legalS1);
			doc.text(136, 819, legalS2);
			doc.text(176, 830, contact1);

			//page number (every page)
			//footer();

			// Save the PDF
			var fileName = 'LimitationFor' + $("#currentView").text() + '.pdf';
			doc.save(fileName);
			//doc.output('dataurlnewwindow');window.open(data);
		}

    }
    $("#loading").fadeOut();
}

//just seeing if this works
function tableToJson(table) {
	var data = [];

	// first row needs to be headers
	var headers = [];
	for (var i=0; i<table.rows[0].cells.length; i++) {
	    headers[i] = table.rows[0].cells[i].innerHTML;
	}

	// go through cells
	for (var i=1; i<table.rows.length; i++) {

	    var tableRow = table.rows[i];
	    var rowData = {};

	    for (var j=0; j<tableRow.cells.length; j++) {

	        rowData[ headers[j] ] = tableRow.cells[j].innerHTML;

	    }

	    data.push(rowData);
	}       

return data; 
}

//clear was clicked to clear filtered polygons and filters
function ClearClick() {
	//clear application date
	$("#AppMonthYr").val("");

	//clear ai selection
	$("#AISelectInput").val("");

	//clear product selection and hidden input
	$("#prods").val("");
	$("#hiddenProdID").val("");
	$("#prodReg").val("");
	$("#hiddenProdRegID").val("");

	//clear selected polygon
	map.graphics.clear();
    pulaSelected = false;
    dijit.byId("tabTwo").set('disabled', true);
    var tabs = dijit.byId("tabs"); 
    tabs.selectChild("tabOne");

    //clear the results
	$("#ResultsTable tbody").html("");
	$("#CodeTable tbody").html("");
	
	//reset map
	var d = new Date();
	var formatDate = dojo.date.locale.format(d, { datePattern: "yyyy-MM-dd", selector: "date" });
	var monthYear = dojo.date.locale.format(d, { datePattern: "yyyy-MM", selector: "date" });
	//layerDefinition to only show effective for public
	layerDefinitions[3] = "published_time_stamp IS NOT NULL AND effective_date <= DATE '" + formatDate + "' AND ((expired_time_stamp >= DATE '" + monthYear + "') OR (expired_time_stamp IS NULL))";
	pulaLayer.setLayerDefinitions(layerDefinitions);

	//remove date from results "Effective Date" and Mapper's Current View:
	var appMonthYrSelect = document.getElementById("AppMonthYr");
	appMonthYrSelect.options[0] = new Option(Date.today().toString('MMMM yyyy'));
	for (a = 1; a <= 6; a++) {
		appMonthYrSelect.options[a] = new Option((Date.today().addMonths(a).toString('MMMM yyyy')));
	}
	
	document.getElementById("currentView").innerHTML = Date.today().toString('MMMM yyyy');
	
	$("#EffectiveDate").text("");
}



function mapReady(map){ 

	dijit.byId("extentSelector").set("initExtent", map.extent);
	dojo.connect(dijit.byId("sliderOpacity"), "onChange", changeOpacity);
	//dijit.byId("tabTwo").set('disabled', true);
    
    function changeOpacity(op) {
    	var newOp = (op / 100);
    	pulaLayer.setOpacity(0.0 + newOp);
	}

    var latLngBar = new wim.LatLngScale({map: map}, 'latLngScaleBar');
}

function getEPAWaterMarkString() {
	return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4TIiaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjMtYzAxMSA2Ni4xNDU2NjEsIDIwMTIvMDIvMDYtMTQ6NTY6MjcgICAgICAgICI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+QWRvYmUgRmlyZXdvcmtzIENTNiAoV2luZG93cyk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIwMTQtMDktMTVUMTU6NTQ6MjdaPC94bXA6Q3JlYXRlRGF0ZT4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMTQtMDktMTVUMTU6NTQ6NDVaPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyI+CiAgICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2UvanBlZzwvZGM6Zm9ybWF0PgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0idyI/Pv/bAEMABgQEBAUEBgUFBgkGBQYJCwgGBggLDAoKCwoKDBAMDAwMDAwQDA4PEA8ODBMTFBQTExwbGxscICAgICAgICAgIP/bAEMBBwcHDQwNGBAQGBoVERUaICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIP/AABEIAZABkAMBEQACEQEDEQH/xAAaAAEAAwEBAQAAAAAAAAAAAAAAAwQFAgEI/8QAPBAAAgIAAwUFBQYFBAMBAAAAAAECAwQRMQUSIUFREyIyYXFCgaHB0RQVUpGx4SMzYnLxNENj8FOCkiT/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A+qQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcucE8nJZgdAAAHjaSzbyXUDyNtcnlGab8mB0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM1+egEOIxMaUs025ae4CD7biLP5VXv1+gE+GWJyfb+7T5AUsZH/8AW89HkBO9m15cJvMCHD2Tw9/ZT8LeT+oGkAAzcTLtcVuSe7FPdQEl+AjGvOvNyXLXMCfBu11fxE008ln0Agf2+rOWe/FcXz/XiAjtJ+1D3pgWaMRC5Pdz4a5gSgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEV+IhSlvavRICnbj7pLuLcXXUCSjB727dKxtvKX/WwJNoQzo3vwvP5AQUY2FdKg03JaAT4fFy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';
		
}

function getEPALogo() {
	//epafiles_logo_epaseal.jpg
	return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4TIiaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjMtYzAxMSA2Ni4xNDU2NjEsIDIwMTIvMDIvMDYtMTQ6NTY6MjcgICAgICAgICI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+QWRvYmUgRmlyZXdvcmtzIENTNiAoV2luZG93cyk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIwMTQtMDktMTVUMTU6NTk6MDFaPC94bXA6Q3JlYXRlRGF0ZT4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMTQtMDktMTVUMTU6NTk6MTRaPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyI+CiAgICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2UvanBlZzwvZGM6Zm9ybWF0PgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0idyI/Pv/bAEMABgQEBAUEBgUFBgkGBQYJCwgGBggLDAoKCwoKDBAMDAwMDAwQDA4PEA8ODBMTFBQTExwbGxscICAgICAgICAgIP/bAEMBBwcHDQwNGBAQGBoVERUaICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIP/AABEIAG0AbgMBEQACEQEDEQH/xAAcAAACAgMBAQAAAAAAAAAAAAAEBgAFAgMHCAH/xAA/EAABAwIEBAMEBwYFBQAAAAACAQMEBREABhIhExQiMQdBURUjMmEkQlJxgZGhFjRDYnLRM1OCscElksLS8f/EABsBAAIDAQEBAAAAAAAAAAAAAAADAgQFAQYH/8QAQBEAAQIEAwQIBAQEBAcAAAAAAQACAwQRIRIxQQUiUWETMnGBkaGx8AZCwdEUIzPxB1Lh4hUXkqMWJENEVHKC/9oADAMBAAIRAxEAPwD1TgQpgQpgQgp9XgQXGWnzJX5CqjDDQG64Vkuq6G0JdKW3Jdk9cTZDLstFwuoqx+qVR4wjm9HoZy7JDF8wemEtt0Rm6NoV/Qj7fPZwhairgM6C3j/QKBcexUcedSatFlyHHarPZjRXHgeckckMhGC6kbYjHHLYgtqJpE+eLjpdzCBuCpApTFSvM1HmlBwPFaqDTsoVac1GqGVobUiXCCpxZB6JausmSIWtwwE+IhGN73vfv3x2YESG2rYhIDsJ0ofSiGYTmNKrCjw8ry65NpLGXmKYcdXhJYjyxJmlskESNttI5cJ/4gIDJO17Ljsdr2ww8vLq0zFW9xNbjWwXG4SaUorCgyyqITeQk1SklBfMZPPq1LY1tFZ0EdcJ+4j2XS6NsJmYOClcL8QtSoPK1vRSY6uVQrxirTwAHn2W5kBwRJqoU9VdRRUb61Z3LSv1eGTnf8cVHQhWmTuBt751omhysYM6JOjBKiOo8w58Jp+qKndFTzRd0wtzS00KkDVb8RXVMCFMCFMCFMCFSu1SZUJb8CkdDTF25dWWxA252VpgVujjofWv0ivfUtxw/ow0Au8PvwHn6pZJNglRjNuVYT60ynvlF5x5ynVGpP6wnNzk9yy65zCXeTUmnVugqo/VXbT/AAEUjG4VoA4AdUtzOWX1vqkdK3IdnOqsKPS5cx+mV/k24uYorxw8wEo6FkAIcFxUK3UOoG3W/K23rhceKGh0KpMIirOWo9SCpNbWjvm1RlJyMNNqs2VHli3EnPvSHorUZkDPmOowdfsThChqpDbTbCo20OkYARdoArU6cBl6qTYND2o7L2UKTQrFFJ994WQitvSnjeMGG/haDUthH5Im/nhMzOvjZ0ArWwpfipshBqkDKFIhVRKi1xjebR1IzbrpuNMJIJCd4IEth1qKf8YIk697MJpS1bZ0yqgQgDVAT8lSX6NHpDFTJqGLrsmbraBw5TrjqvaXfhHhKZFrG1y2S6b3dDnwHl5bvUAF8hSludMjooGDalbKoiUevjEyrQGXn6ZUKZD41SnMLqZARDhoyorqYdVx3ey3sIra10XFp8eHiixCA5rnWGvGvEUHmVANdutyIC3UvMNJr1XddpjbseYjixoteaTXHlHGS5g+20ewr1IHGRLju2V7LhUaUfBZvUNqluorwJ7q4e8LrYgcbeKa6fVHHZJwJrYxqk2PE4QnrBxq9uK0SoKqiKukkUUUV+SiRZz4dsQu3379mjw7xVhhSkpgQpgQqWpvS6hMWkQHuC2CItVmNl71oSS4st2+F1xN9XcR37kK4fDAaMRHZ9+weZ71B17BVeZo5RmG4BwXf2f0AkORSmzKXBktXUDRsNSkC7aVEdl2JFFbpblDXeBHSah2TgeZ98LpUQafLy0W+gZe5uAE+vxhKfUWGVq1PcECjk+18L6tKhILumyFZfJE8kxGYmcLsMM7rScJ1odK8FJkOoq7M5pnxnpymBCmBCmBCmBC1SozEuK9FkDrYfAmnQuqXA00kl0svZcSY4tNRmFwiqR69TJeW6C61BNxwXmnIiVcWlOZEYFleVbVWAJ10Ud6UO1xRfxxry8UR4m9oQcNbONd43sLaa+SrPbgFvHhwVrQ6LPlZebSc69HfI0l0onSVyXBQ2xUWnHHLq4bZEYlqvqHpW6XxVmYzRE3aHR3B3Omlbd90yG04b/srSiVSRKR6JPAWqpBVAlg3fhmhfA80i3JG3LLZF7KipdbXWrFYBcdU5fb32qbHVzzVphSmgqxUvZ8PiiHGkuELMSPdBVx5xbCN18vMvQUVfLE4bMRUXOolmvM51ocKjxspQ2KibsxPbsiUqASg51Ov7EG5Eqqtr27IlsaEp+HiF5jEto3dpx0GvvVKfjbTDxunPGYnqYEKYELkfiv4+0/Kck6NRGQqVdDaQpqvLxl9D07mf8AKipbzXHp9j/DjpkdJE3YfmVRmZ0MsLlcIqnjZ4oVGQrp19+N6NRUFgE+5BS/5rj2MHYEmy2AHtust05EOqMoPj74nUl1CKp+02bopx5wI5f5ax0OJ+eFTHw3JxBZuE8lJk9EbzXovwv8XaFnuIQNjyNajjqlU0y1Lp7cRsttYX/FPPHhdrbFiSZ/mYcj91ry8yInanzGMrKmBCpM5yM0xstzHsrRmpdcFB5SO+tgLqTV5gl0G9upMW5FsExQIxIh60S4pdh3c0NIGrBSafX5jDbNcgsCVUYYRDQmiFFlMASqi7KmsN/iFPK+A4MZY0ksJtXyK5eldUxNOtPNA60aONOIhNuCtxIV3RUVNlRUxUITQUsZglVd6dISlNDIfpjTaRg72mzF4SGfoLDCqa77oeLksxlsZoCb9gv5nLmEl5OmnqtOVq7mdytu0argy+DbbzzU4AOO9wmnuA2TzC6hTjkhkCiSbD23xYm5eCIeNlRcWzFaVNDytXtUYb3VoU34y1YUwISP4y51eyjkSZPiFpqMlUhwF+y67fr/ANAIRJ80xr7DkRMzIYeqLnsCrzUXAyuq8WuGZmRuEpmaqRmSqRKpXVVVe91XH1gWyXnF2rwM8FqFm2kSK/mA3XInGKPEhMnw0VQRNbjhD1dysiIqY8l8QbdiSzxChUBpUn6LSk5QPGJyrvHbwipWSyg1OiOGlLnEsc4rxK4TbwprRRJe4kKL37Knzw/4e2y+aqyJ123ryUZ2WEO4yXNaBXqlQKzErFNcVqbCcRxpfJbdwL1Ek6VTHoJmWbGhmG64IVKG8tNQvdWXa3FrtCgViL+7z2AfBO9tY3UV+YrsuPjcxBMKI5hzaSPBelhvxNrxVjhSmham5Maguuw+Cj4JqRZJEDVkW5aiFFVOm+9sMhBpdR1acs1x2VlUZUrlaq7IzZseNDhSBVYIA44brwoWz/WDWlsx3FFG9l3xanJeHCOFpJcM+A5a3SoTy65RWX/o/OUtV/cHl4CXuvLve8a2XsI3Jsf6MVot6O4jz9371NnDglarR6xVqG+/TaZHqSyqnIddJx02CbGIaxWnGk1MKTmhhP4oJ88aMq5jH77i2jRS1a1vfO1+BSHgkWFbq8yHEVmjE4UubMN10tRVBxp5wNK6eGBtE6nDRb2u4X34RtF9X5NH/qCPWl+4JkAW170yYoJymBC5f475PXNFKpUVZvJgxIN1ejial4dk+sPbEHfFZ2L+aIfS493rYaa8Csnaz8LR2rjJeBrQW1VxR1LYbsDuvp8eOf5zO/8AF/3P7Fh9PyXRvC6PUPD6LKhlPGoUh8+OrLgcEmnbIKkJ6iSxIiXRUxhbV/iSJ1wd+HwvFrPrUf6Vcl9pmEMqjtQvilRKrn+VGR+opApkK6xoTbWtdZbE4ZqaaltsmyWTDNk/xObJA0l8Tna9J/YozG0DE0oEiB4GsmCGFbVRPqEkYRUVF3268bH+czh/2v8Auf2Kr069FeFtGWi5DpVLWRzXKi4AvW03TjGqbXLte3fDRtU7Q/5kt6PpL4a1ppnQZ5r08g6sEH3mmvAraipfZcCFy6bIjwpsSlVSbSYp02pc2lakTw5zS4/xVAGCTWDjoqjRopabeuyY9FDaXNL2B5xMphDd3KmeoGY1VI2NDSxzrdO8uWzBzKyTlhCdCcRwtCqt4jocNLpfb6UeMP8A6fYfX9la+buSWcGmzsp5ZeqJTnagEMXQcahvVCO4TooprKYEHWj1LvvY/RU3xrwnvZEiBuENxU6wabfymxHoqxALRWteyqe8tCg0OIiMtMdH+ExHOI2m6/Cw4iG3fvZcZU1+ocz2nF5jNWYfVR0p1xqM662OswFSEO11RO2KMxELIbnNFSATRERxDSRcqhi51jG2LkmK6w0S2R5OsL/ftjzUv8Vw3DFEY5jTrmPos2HtVpFXNIHHRDZ2p65lys8lFkIs+MqSIZgu+sL9C+msVUd8aU10M/LnAQ/X3wXZ6GJmAejNSLhecKjWazJeFJj7nEjl0gvQoGnyS1iTHkGSrGVAC8K97jmpNzBWJrHAkySca8x2S9vW1r45DlYbDUC6HRXHNZFmSuFF5VZh8G2n529NXf8AXHPwcLFipdHSupSqNy1IzRPlx6HSn3NUgtACm+hF+Ir7qIim+Gt2eyNEG7VxTpYRIjgxuq9MxvZlApMWG4+gNRmxaAj+ItKWUrbqqqu649tEmYEnDAe4NAHuy98HQ5eGGk0ACrn87wkJBjMOP6l0ia9Aqv6r+mMKN8WwQaQ2udzyCpv2uz5QSmTHrFrLnOY4rr+aJMgqlBYjQzRGIb1PcftIbi80bpqLrQumLW4qWw+XVjdlngQQMLiTripbFhpkaCufHsVSIN7MeCA8b09qZKpD7HWj0ht4FIFTpNg1vpUXFTv2wvZf5cdw4A+q5NGrQs6vDkNZCpMdjixlgNck9UHKitMjMFFdRpzi6TbVziK0Qguhe/lhsm8GO4m9b0wYiaits6U1v4rkQbg5c6Ju8PrrllouYCQBvSDa4cnnUbbN4iBlZFy1q2KoK74obS/WypYaYdM6aVT4HV9lMmKCclikq3TavKoshEWPJXixdXZb/V/T9MeP2aWyk0+Tf+m/ebX098Fjy1IUV0F3VdcLKp5YcYNZ1ENY8kd1YFekvu/t2xLaHw+6GemkzgePl0PZ9sl2Y2eWnHB3XcEj17IdMzo65JjkNLzKKfSBVF4MhU21EPcS9VT8lxXko7J/dO5MDMaO+x4rKfKMnDbcja8CkGd4R5/iOKPsxZAp/EYMDRfu3Qv0wx+zI7flqsyJseZb8texEUnwZz1OeEXogwGbpqefMdk/pFSJcTh7KjO0p2pkHYkw83GEc10nL2XKXlL/AKfQw9oZieTRJqBJ8PqIpugon/3C485+Hf0EqOkmDmeHvwGq14UJsscEHfjHMpqgZTYQ+ZqhrNmFuWpehPw8/wAfyxck/htlekmT0sU8cv6+nJaMHZoriib7vJCGoVfMbEdgbQKZ1nbYdd/l80RPzxSfSdn2w2fowLnhX97eKQaR5gNHUhprx7RbS5Xm5imSpNXrI0eTMCG+6xNdCqSIQojMVBfcVsOgdQaWxTuafK1/RybntDIeMCoBG4HZutz58lSigGpp50Vj4o5derlKpOX6ciNvipSmwVXEFGYwC0qXBCLZZA90xnyMz0TnRHVOneb/AETYzMQACLq1NMHZBgcZoqHUFqzI1ElSIbUtotRmfUrai6bqiVlso9t9iWi6Gpxtw7ovYjxtRcePI1uvvh9WY8yo1dvWr06SYT5TkeM8zBBDBGWxaN5BJ0iRrUp26u/a2GbSgFrWaNG6KkF3E1plnloiA6pPHyTvjIVlVGY6J7SjITS6ZjHUwfb/AE3xh7c2T+Kh1baKzqn6e9VRnpTpW26wyQ2X8yDJ+hT/AHU9vpXVtrt/5fLFTYu3hF/JjbsYWvr/AF5JUlP4tx9njzQ2baYbJBWoXu32VTjKP5IX/C4qfEsgYZE3Cs9pFfv9DySdpS+H85liM1uqtXWVlbnozitOKoatC2US1IhJh+0dp9Ns3poZwutloa3CZMzOOWxtsbIjMtZKn08QZX6ZI6WvVPUv7Ytbe2oZaAAz9V9h902fmuiZbrOyWzLlFCmw9RpeW8mp817/ANP4YbsPZQlIVT+q7rH6KUjKdE2/WOar65mJx932XSPfSXeg3R7D6oK/7r5YzNrbbdEd+Gld57rEjTs++iqzc8XHo4V3HVW9Do7VLhIyK6nC6nnPUv7Jjb2RsxsnCwC7jmeavSksILKa6qwxqK0uXQufrWegiVugUtipRw5iYbnGUjabc0NE0qojcnbdCX4Oy2XbHon4YUtihveWmwy766t+vNUhVz6ECvvxT4yiv5kkO6F4cGOMcHPLiPlxXRRL+Qg0vbzxhGzBzP7fVWvmWusqMKoQqkSDyxryM5VQU6XyTgGSkqXQHem2/wAar64lCGIFuuY7s/L0Q6xqufC5PoGZGYgy3Zk8pJyp86qPDBi8Mls8+MdjSriIPu2yeVUvZARUTbeo2NCJoA3DQBoxGugqcuJpfiqfVdz52XRJL71VpLcugT2ybeTWy+2ouNugv2T3T8Ux4vbErNYC2E7o4g0I8uSbMB72flmhSPUH6+w7w5rsgD/mMrfh5Lj5bOxp2G7DGdEB5krzUZ8dpo8ur2qvIzItREpEv1l74zHOJNTmqpNVbRsz1FuKcR60qOYqGl290Rf5u/5424HxDMNhmE+kRhFN77q8zaEQNwnebzQ0SdopcyES9LvDNv8AqEkv+af7Yqy05hl4kE5OwkdoI+nokw4tIbmcaIqdWxcr6T9HGZYVEYbVbJYE2Xz+tvi5N7WDp3pqYmsyHZl53To03WPjzAyWFTzNVagigTnBZX+E3sn4r3XC9ofEEzM2Jws4D3UrkxPxIvIcAgIsyVENXIzpNGuykPpjMl5qJBNYZLTyVWHFcw1aaK4ptbzXJeQIrhPr53AVFPvW235435Da204rqQyX9w8yr8CbmXmjTXuTXUq0dIprUicyUl26JJCIiKQj9ZwWyJCNB80G5eiY+obPgRYjQHlofTnSvD916EOLW72etFGq9l2XSf2hjyWZUGO24YzAsWkUT3govcV6bKPe/fD3wIrH9GQQ46KYe0jFotmX4kpin65gIE6W4cmUKb6SdK6NqqKSLww0t3Rfq4hGILrZD355rrAjZMZmVGdjPjqZfAm3RuqXE0sqXSypsvlhYNDVdIqkTMdKYOmyDqcI6jVKO1fQCo2VQjCtmzdfEOMQgiqrrYL8V9iRRvrSUch9Guwtcf8ASeQrTsJ8c1WiNtcXHmsct1yfRjie2Zcf2ZVHQiU5lgBBjinp5ZacLKKpRnGnE1a9wIV3suGTUu2LXowcTBU1z546/MDwzC5DeW55H3bkn91hl4NDoC4P2SS6frjAiQmxBRwBHNWXNDs7qrfypQXlvyyAvq2qj+ibYx43w3JP+SnYSP6Km/Z0F2i0fsVQ/suf964rf8JyfB3il/4VB5+K+ycn0goptR2+C6VrPLc1Sy38188Sj/C8qYRawYXHW5+q6/ZkIto0UPFZv5QoT2/B4Zeatko/pumGRvhmTf8ALhPI+wpP2ZBOlEMuRKRqujj6J6ah/wDXFM/B8rXN/iPsk/4PC4uREfJ1CZW6tE8qf5hKv6JZMWoPwvJsPVLu0/sms2XBGle1GTpcWlQi4TYq7ocWJBb0gb5ttk5w2k8yVAXHopWVbZrQGs7LDSquWYLLmrtPXM1VoU+ZKgzZlVjOFAmxo4qcPSHGJl5l4nQfj36FU0ExO3ZV29IIvQMe1oc0MNwT1tKgilHa2sR2KrTGQTQ18k7RYEKS8NLiMsNUynGLlQSKKMtuTB0uC2gB5CvWe/fSm/VjFfEPWJJccq33fdvHkrIAy4JjxUTVMCEBVaYssQejny9Rj35SV9nVZSAkS2ps9KahXbZF7oioxkSnYffjzUXNqk2sUF+rS2VpYt03McZ6LzQSesY0NrUWqG2nQYE6iEnZCJLHuOlNWXmgxpx70Mg5ak/zHjS3LTOqrvZXKx95IqhS50OoSG6a+LmT6UnLTZVQcs5zLakUl5p63WgkvveItlO+lU07xmGNc0Yh+e+4DRpoCPSmmea6wkG3VCa6TWKbVoLc+nvI/EeUxbcsQ3VslAtiRF2IVxmxoDobsLhQhPa8OFQjMKUlMCFMCFiZg2CmZIIClyJdkRE81XABVCo5Oboyyo8WkMFWXn2ea+iuNcMY+vh8TiGQgtyugoi72XFxskaEvOAA0vXPPJKMXhdUfsOXLqkiLWX3KrDrAi9Aq0a7aQpEW6i22IKYNafjbdvdVuJKu2Ln4hrWAsGAssWn5gfXgR2EapWAk3vXXgj4kRgHnoVKGN7ccQQrtdjsNtLqtupab6ni7oN+nuvki1IsUnrVwfK0mvseviQxreGepTHT6fFp8NqHFDQw0myeaqq3IiXuRESqREu6qt1xUe8uNTmmgURGIrqmBCmBCBqdHi1DhG4psyo91izGV0vNKXfSu6Ki2S4kiivmi4YyIW9nBRc2qXa5T25TLUfNbLjkGIvFCoQjcajKaJq4khlslNtW1DUirqBO977YuS8YsNYVMRtQ3PcTx7jolPbXrKtyvTZVOqNBalIdShRYJNxKrFRHmDnSjVyW84QrqC6CiCSpbcu2Lc1GbEa8t3SXXabHCLNA+vcoQ20I1t5q9zxXKlS49Obpv73PloxdGClkjYtOOmQsiTaktm/XFOQl2xC7Hk1tc6agZ34pkZ5FKapYqviLmymi3zEFpt5qntTpLJx311E5IcZETcA1GKhA2hXc1abrftjRg7MgPycaY6C44A//AFnpSqS6O4eHvsVhU83V5oqnUGnY7cKl1JqmHS1bUpDguk2HFF3VsZcfW2OhUVE+eyIUnDOFpriewuxVsKVtThahNVJ0V1zoDRDT8t1SbFzHR3pcipVSOUafSZE3STRaU1thwkEY/wDitOAXR2VL4nDmmMMN4Aaw1a4Dzv1siDnnkuGGTUZnREhSj5ePLqsmXQZzWpiBKSSw/PebfW5sONCybHxIOhttC0/Vthbo4BIYGxGnMUIaCMiDWvaTSuq7h429Vb0qnTCpsenQWnaPRI4iIKa/TXgtq9V4N1XqUved9gWy4pxom8XO3nnwH39O1Na21BYK9gQIcCI3EhtCzHavobH5rqJV81UiVVVV3Vd1xVc4uNTmmAURGIrqmBCmBCmBCmBCmBCq5GW6Y444/HQ4EtzUpSYZKySke6maJ0OLf/MEsNEd2txzv+3co4AhKhErkUEktT2JAsaeFzsVHHRIl0kSOMnGRLiVvhxIRW0uD3GnrVRoVy8vGWHUpT7MzLTDqyo4x5RE9fiM3NeGqcPtdS/PG6NluYBhiEUNRbXxVQzFcwioPiPGrmZYvDy/BYrBD7mqPpzBt6W1c7IjRL2snWlsIiyroME77iz+XLWnP0XWRcbshVdQWmVZ8LS6qY9aLaE0DCKCW6VVzmD39RNFxj9I0ZDxv9vRW6Hit8GiUuC6b8aOKSXLo5JO7jxIq3sTpqTipsmyriLojnZ5LoYAjsQUlMCFMCFMCF//2Q==';
}

dojo.ready(init);