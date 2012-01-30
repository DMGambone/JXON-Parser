/**
  * JXON (JavaScript XML Object Notation) is a library that converts a standard XML document to a valid JSON object
  * in the most natural format possible
  * @author Dino M. Gambone
  * @version 1.0
  */
var JXON = (function()
{
	/** 
	  * Represents a single instance of an XMLNode in JXON format
	  * @param {JXONNode} [parent] A parent node to this instance
	  */
	function JXONNode(parent)
	{
		this["#parent"] = parent;
	}

	JXONNode.prototype.toString = function()
	{
		if(this["#text"] !== undefined)
			return this["#text"];

		return "[Object JXONNode]";
	}

	/**
	  * JXON Parser class
	  */
	function JXONParser()
	{
		this.emptyXMLValue = null;
	}

	/**
	  * Parses an XML Node.  If the XML Node contains children, those children will also
	  * be parsed.
	  * @param {IXMLDOMElement} xmlNode Any object implementing the W3C IXMLDOMElement interface
	  * @returns {JXONNode} The JXONNode object representing the XML Node
	  */
	JXONParser.prototype.parseNode = function(xmlNode, jxonParent)
	{
		/**
		  * Converts a string value to it's closest native format
		  * @param {String} value the value to convert
		  * @inner
		  * @remarks Taken from https://developer.mozilla.org/en/Parsing_and_serializing_XML
		  */
		function convertValue(value)
		{
			if (/^\s*$/.test(value)) { return null; }  
			if (/^(true|false)$/i.test(value)) { return value.toLowerCase() === "true"; }  
			if (isFinite(value)) { return parseFloat(value); }  
			if (isFinite(Date.parse(value))) { return new Date(value); } 

			return value;
		}

		/**
		  * Parses an XML Node.  If the XML Node contains children, those children will also
		  * be parsed.
		  * @param {IXMLDOMElement} xmlNode Any object implementing the W3C IXMLDOMElement interface
		  * @returns {IXMLDOMElement[]} An array of attributes and children nodes
		  * @inner
		  */
		function getAllChildrenElements(node)
		{
			var children = null, length = 0, idx = 0;
			var elements = [];

			children = node.attributes;
			length = children.length;
			for(idx = 0; idx < length; idx++)
				elements.push(children.item(idx));

			children = node.childNodes;
			length = children.length;
			for(idx = 0; idx < length; idx++)
				elements.push(children.item(idx));

			return elements;
		}

		//Process any children elements
		var children = null, length = 0, idx = 0;
		children = getAllChildrenElements(xmlNode);
		length = children.length;

		//If there is nothing to build, then just return the default value.
		if(length === 0)
			return this.emptyXMLValue;

		var jxon = new JXONNode(jxonParent), child = null;
		var key = "", val = null, text_val = "", child_type;

		//Process every child of the current node
		var text_only = true;
		for(idx = 0; idx < length; idx++)
		{
			child = children[idx];
			child_type = child.nodeType;

			switch(child_type)
			{
				case 1:		//Element child type
					key = child.nodeName;
					val = this.parseNode(child, jxon);

					break;

				case 2:		//Attribute
					key = "@" + child.nodeName;
					val = child.nodeValue.replace(/^\s+|\s+$/g, "");
					val = convertValue(val);
					break;

				case 3:		//Text - Cleaned up
					key = "#text";
					if(text_val === null)
						text_val = "";
					text_val = text_val + child.nodeValue.replace(/^\s+|\s+$/g, "");
					val = text_val;
					break;

				case 4:		//CDATA - Not cleaned up
					key = "#text";
					if(text_val === null)
						text_val = "";
					text_val = text_val + child.nodeValue;
					val = text_val;
					break;
			}

			if(length === 1 && child_type !== 1)
				return convertValue(val);

			//Based on wheter or not the key is already defined,
			//add it to the object, add to the array of values,
			//or convert the existing value to an array and add
			//it to that array.
			if(jxon[key] === undefined || key === "#text")
			{
				//Don't add #text is text_val is empty
				if(key !== "#text" || val.length != 0)
					jxon[key] = val;

				if(key !== "#text")
					text_only = false;
			}
			else if(jxon[key] instanceof Array)
				jxon[key].push(val);
			else
				jxon[key] = [jxon[key], val];
		}

		if(text_only)
			return convertValue(jxon["#text"]);

		return jxon;
	}

	/**
	  * Parses XML string.
	  * @param {String} xml Valid XML string
	  * @returns {Object} The JavaScript Object representing the XML Node
	  */
	JXONParser.prototype.parseXML = function(xml)
	{
		if (window.DOMParser)
		{
			parser = new DOMParser();
			xml_doc = parser.parseFromString(xml,"text/xml");
		}
		else // Internet Explorer
		{
			xml_doc=new ActiveXObject("Microsoft.XMLDOM");
			xml_doc.async=false;
			xml_doc.loadXML(xml);
		}

		var root_xml = xml_doc.documentElement;
		if(root_xml === undefined
			|| root_xml === null)
			return null;

		var jxon = new JXONNode();
		jxon[root_xml.nodeName] = this.parseNode(root_xml, jxon);

		return jxon;
	}

	/**
	  * Loads an XML document and parses it.
	  * @param {String} url The URL of the XML file to parse
	  * @param {Function} callback The callback method to call when the file is loaded and parsed.  
	  * The callback will receive 1 parameter which will either be an instance of Error 
	  * in the case of an error or a generic object.
	  * @returns {Object} The JavaScript Object representing the XML Node if callback is not specified.  If 
	  * callback is specified, this will return undefined.
	  */
	JXONParser.prototype.parseXMLFile = function(url, callback)
	{
		var xhr = null;
		if (window.XMLHttpRequest)
			xhr = new XMLHttpRequest();
		else // IE 5/6
			xhr = new ActiveXObject("Microsoft.XMLHTTP");
			
		var async = (callback instanceof Function);
		xhr.open("GET", url, async);
		if(async)
		{
			var self = this;
			xhr.onreadystatechange = function()
			{
				if(xhr.readyState != 4)
					return;

				if(xhr.status !== 200)
					callback(new Error(xhr.responseText));

				callback(self.parseXML(xhr.responseText));
			}

			xhr.send(null);
			return undefined;
		}
		else
		{
			xhr.send(null);
			if(xhr.status != 200)
				throw new Error(xhr.responseText);

			return this.parseXML(xhr.responseText);
		}
	}

	var module = 
	{
		Node: JXONNode
		, Parser: JXONParser
	};
	return module;

})();