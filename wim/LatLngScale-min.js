/* 
    Copyright 2012 USGS WiM
*//*
    Author: Nick Estes
    Created: October 25, 2012
*/
dojo.provide("wim.LatLngScale"),dojo.require("dijit._Container"),dojo.require("dijit._TemplatedMixin"),dojo.require("dijit._WidgetBase"),dojo.require("esri.map"),dojo.declare("wim.LatLngScale",[dijit._WidgetBase,dijit._OnDijitClickMixin,dijit._Container,dijit._TemplatedMixin],{templatePath:dojo.moduleUrl("wim","templates/LatLngScale.html"),baseClass:"latLngScale",attachedMapID:null,constructor:function(){},postCreate:function(){var e=this,t=dojo.style(document.body,"width")/2,n=dojo.style(this.id,"width")/2;dojo.style(this.id,"left",t-n+"px"),this.attachedMapID!=null?dojo.connect(dojo.byId(this.attachedMapID),"onmousemove",function(t){if(t.mapPoint!=null){var n=esri.geometry.webMercatorToGeographic(t.mapPoint);e.textNode.innerHTML="Lat: "+n.y.toFixed(4)+", Lng: "+n.x.toFixed(4)}}):console.log("attachedMapID is null")},_onChange:function(){var e=this,t=dojo.style(document.body,"width")/2,n=dojo.style(this.id,"width")/2;dojo.style(this.id,"left",t-n+"px")}});