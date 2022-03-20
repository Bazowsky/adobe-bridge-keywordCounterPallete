/*
2019 rewrited by @AlexBazowsky,
.--------------------------------------------------------------------------.
|    Software: Keyword counter                                             |
|     Version: 0.75                                                        |
|        Site: http://code.google.com/p/my-abobe-scripting/                |
| Description: This script show total keywords in file and have            |
|                               many use for for microstocker fuctional.   |
| -------------------------------------------------------------------------|
|     Admin: Tyzhnenko Dmitry (project admininistrator)                    |
|    Author: Tyzhnenko Dmitry t.dmitry@gmail.com                           |
|   Founder: Tyzhnenko Dmitry (original founder)                           |
| Copyright (c) 2009-2013, Tyzhnenko Dmitry                                |
| -------------------------------------------------------------------------|
|   License: Distributed under the General Public License v3 (GPLv3)       |
|            http://www.gnu.org/licenses/gpl.html                          |
| This program is distributed in the hope that it will be useful - WITHOUT |
| ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or    |
| FITNESS FOR A PARTICULAR PURPOSE.                                        |
'--------------------------------------------------------------------------'
*/

function KeywordCounter() {
  this.requiredContext = "\tAdobe Bridge CS4 must be running.\n\tExecute against Bridge CS4 as the Target.\n";
  this.version = "0.75";
  this.author = "Tyzhenenko Dmitry";
  this.contributor = "AlexBazowsky @2019";
  $.level = 0; // Normal operation
  //$.level = 1; // Debugging level
}

KeywordCounter.prototype.run = function() {
  if(!this.canRun()) {
    return false;
  }

  function formatBytes (a,b) {
    if (0==a) return "0 Bytes";
    var c=1024,
    d=b || 2,
    e = ["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"],
    f= Math.floor(Math.log(a)/Math.log(c));
    return parseFloat ((a/Math.pow(c,f)).toFixed(d))+" "+e[f]
  }

  String.prototype.trim = function () {
    return this.replace(/^\s*/, "").replace(/\s*$/, "");
  }

  String.prototype.remdupspace = function () {
    return this.replace(/\s+/g, " ");
  }

  Array.prototype.unique = function () {
    // Thx for Martin
    // Get from http://www.martienus.com/code/javascript-remove-duplicates-from-array.html
    var r = new Array();
    o:for(var i = 0, n = this.length; i < n; i++) {
      for(var x = 0, y = r.length; x < y; x++) {
        if(r[x]==this[i])  { continue o; }
      }
      r[r.length] = this[i];
    }
    return r;
  }


  // load the library
  if (ExternalObject.xmpLib == undefined) {
   ExternalObject.xmpLib = new ExternalObject("lib:AdobeXMPScript");
  }

  this.paletteRefs = new Array();
  this.panelTitle = new Array;
  this.panelDesc = new Array;
  this.panelKeywords = new Array;
  this.fieldTotalRefs = new Array();
  this.editKeywordsRefs = new Array();
  this.editTitleRefs = new Array();
  this.editDescrRefs = new Array();
  this.fieldFilenameRefs = new Array();
  this.masterThumb = new Array();
  this.chkSyncBox = new Array();
  this.clipboardMaster = new Array();
  this.chkSortBox = new Array();
  this.chkAddBox = new Array();
  this.chkCloneTitleBox = new Array();
  this.chkCloneDescrBox = new Array();
  this.flags = { clipEmpty:true };
  this.modified = null;
  this.filename = null;
  this.reloadTaskID = null;
  this.HotKeyFetchTaskID = null;
  var wrapper = this;
  app.synchronousMode = true;

  function changeTotal( str) {
    field = wrapper.panelKeywords[0];
    field.text = "Keywords (" + str + ")";
  }

  function changeTotalDescr( str) {
    field = wrapper.panelDesc[0];
    field.text = "Description (" + str + ")";
  }

  function changeTotalTitle( str) {
    field = wrapper.panelTitle[0];
    field.text = "Title (" + str + ")";
  }

  function changeKeywords( str) {
    keywords = wrapper.editKeywordsRefs[0];
    keywords.text = str ;
  }

  function changeTitle( str) {
    title = wrapper.editTitleRefs[0];
    title.text = str;
  }

  function changeDescription( str) {
    descr = wrapper.editDescrRefs[0];
    descr.text = str;
  }

  function changeFilename( str, size, dimens) {
    wrapper.fieldFilenameRefs[0].text =  str;
    wrapper.fieldFilenameRefs[1].text = size;
    wrapper.fieldFilenameRefs[2].text = dimens;
  }

  function saveMetadata(thumb, title, descr, keywords, params ) {
    if (params.sort == null) params.sort = true;
    if (params.append == null) params.append = true;
    if ( title != null || descr != null || keywords != null) {
      app.synchronousMode = true;
      md = thumb.metadata;
      app.synchronousMode = false;
      var xmp = new XMPMeta(md.serialize());
      md.namespace =  "http://purl.org/dc/elements/1.1/";

      if (title != null) {
        title = title.trim();
        title = title.remdupspace();
        xmp.setLocalizedText(XMPConst.NS_DC,"title","","x-default", title);
      }

      if (descr != null) {
        descr = descr.trim();
        descr = descr.remdupspace();
        xmp.setLocalizedText(XMPConst.NS_DC,"description","","x-default", descr);
      }

      if (keywords != null) {
        for (var k  =0 ; k < keywords.length; k++) {
          keywords[k] = keywords[k].trim();
        }

        if (params.append) {
          exist_keywords = md.subject ? md.subject : [];
          exist_keywords = exist_keywords.concat(keywords);
          keywords = exist_keywords;
        }

        if (params.sort) keywords = keywords.sort();

        keywords = keywords.unique();

        for (var k  =0 ; k < keywords.length; k++) {
          keywords[k] = keywords[k].toLowerCase();
          if (keywords[k] == "") keywords.splice(k,1)
        }

        xmp.deleteProperty(XMPConst.NS_DC,"subject");

        for (var k  =0 ; k < keywords.length; k++ ) {
          xmp.appendArrayItem(XMPConst.NS_DC, "subject", keywords[k], 0, XMPConst.ARRAY_IS_ORDERED);
        }
      }

      var updatedPacket = xmp.serialize(XMPConst.SERIALIZE_OMIT_PACKET_WRAPPER | XMPConst.SERIALIZE_USE_COMPACT_FORMAT);
      app.synchronousMode = true;
      thumb.metadata = new Metadata(updatedPacket);
      app.synchronousMode = false;
    }
  }

  function syncMetadata(masterThumb, listThumbs, params) {
    if (params.title == null) params.title = true;
    if (params.descr == null) params.descr = true;
    if (params.keywords == null) params.keywords = true;
    if (params.sort == null) params.sort = true;
    if (params.append == null) params.append = true;
    md = masterThumb.synchronousMetadata;
    md.namespace =  "http://purl.org/dc/elements/1.1/";
    master_title = master_descr = master_keywords = null;
    if (params.title == true) master_title = md.title[0] ? md.title[0] : "";
    if (params.descr == true) master_descr = md.description[0] ? md.description[0] : "";
    if (params.keywords == true) master_keywords = md.subject ? md.subject : [];
    for ( var k  =0 ; k < listThumbs.length; k++)
    {
      saveMetadata(listThumbs[k], master_title, master_descr, master_keywords, { sort:params.sort, append:params.append} );
    }
  }

  function copyClipboardMetadata(thumb) {
    wrapper.clipboardMaster.length = 0;
    wrapper.clipboardMaster.push( thumb)
    wrapper.flags.clipEmpty = false;
  }

  function pasteClipboardMetadata(thumbsList) {
    if (!wrapper.flags.clipEmpty)
      syncMetadata(wrapper.clipboardMaster[0],
        thumbsList,
        {
          title:wrapper.chkSyncBox[0].value,
          descr:wrapper.chkSyncBox[1].value,
          keywords:wrapper.chkSyncBox[2].value,
          sort:wrapper.chkSortBox[0].value,
          append:wrapper.chkAddBox[0].value
        }
      );
    else alert("nothing in clip");
  }

  function reselectFiles() {
    t_thumb = app.document.selections[0];
    app.document.deselectAll();
    app.document.select(t_thumb);
  }

  function flushPalette() {
    changeTotal( 0);
    changeKeywords( "");
    changeTitle( "");
    changeTotalTitle( 0 );
    changeDescription("" );
    changeTotalDescr(  0 );
    changeFilename( "--", "--", "--");
    wrapper.modified = null;
    wrapper.filename = null;
    wrapper.masterThumb.length = 0;
    wrapper.fieldFilenameRefs[3].enabled = false; // Save button
    wrapper.fieldFilenameRefs[4].enabled = false; // Sync button
    wrapper.fieldFilenameRefs[5].enabled = false; // Copy button
    wrapper.fieldFilenameRefs[6].enabled = false; // Paste button
    for ( var i  =0 ; i < wrapper.chkSyncBox.length; i++) {
      wrapper.chkSyncBox[i].enabled = false;
    }
  }

  function fillPalette(md,file) {
    md.namespace = "http://purl.org/dc/elements/1.1/";
    changeTotal(md.subject.length);
    changeKeywords(md.subject ? md.subject.join(", ") : "");
    changeTitle(md.title ? md.title[0] : "");
    changeTotalTitle(md.title ? "words: "+(md.title[0].trim().split(/\s+/)).length +" | chars: "+ md.title[0].length : "words: 0 | chars: 0");
    changeDescription(md.description ? md.description[0] : "");
    changeTotalDescr(md.description ? "words: "+(md.description[0].trim().split(/\s+/)).length +" | chars: "+md.description[0].length : "words: 0 | chars: 0");
    changeFilename(
      app.document.selections[0].name,
      app.document.selections[0].fileSystem.quickMetadata.width + " x " + app.document.selections[0].fileSystem.quickMetadata.height,
      formatBytes(file.length)
    );
  }

  function ChangePicture() {
    if (app.document.selections.length == 1) {
      wrapper.masterThumb.length = 0;
      wrapper.masterThumb.push(app.document.selections[0]);
      img_path = app.document.selections[0].path;
      xmp_path = img_path.substr(0, img_path.lastIndexOf(".")) + ".xmp";
      img_file = new File(img_path);
      xmp_file = new File(xmp_path);
      if (xmp_file.created == null) tst_file = img_file;
      else tst_file = xmp_file;

      wrapper.filename = img_file.name;
      wrapper.modified = tst_file.modified;
      if (md = app.document.selections[0].metadata) fillPalette(md,img_file);
    }
    /*
    else {
      var flag = true;
      for ( var i  =0 ; i < app.document.selections.length; i++ ) {
        if ( wrapper.masterThumb.lenght > 0 && app.document.selections[i].name == wrapper.masterThumb[0].name ) {
          flag = false ;
          break;
        }
      }
      if (flag) {
        wrapper.masterThumb.length = 0;
        wrapper.masterThumb.push(app.document.selections[0]);
        md = app.document.selections[0].synchronousMetadata;
        fillPalette(md);
      }
    }
    */
    if ( app.document.selections.length == 1 ) {
      wrapper.fieldFilenameRefs[3].enabled = true; // Save button
      wrapper.fieldFilenameRefs[5].enabled = true; // Copy button
      if (!wrapper.flags.clipEmpty) wrapper.fieldFilenameRefs[6].enabled = true; // Paste button
      for (var i  =0 ; i < wrapper.chkSyncBox.length; i++) {
        wrapper.chkSyncBox[i].enabled = true;
      }
    } else {
      wrapper.fieldFilenameRefs[3].enabled = false; // Save button
      wrapper.fieldFilenameRefs[5].enabled = false; // Copy button
      wrapper.fieldFilenameRefs[6].enabled = false; // Paste button
    }

    if (app.document.selections.length > 1) {
      wrapper.fieldFilenameRefs[4].enabled = true; // Sync button
      if (!wrapper.flags.clipEmpty) wrapper.fieldFilenameRefs[6].enabled = true; // Paste button
      for ( var i  =0 ; i < wrapper.chkSyncBox.length; i++) {
        wrapper.chkSyncBox[i].enabled = true;
      }
    } else {
      wrapper.fieldFilenameRefs[4].enabled = false; // Sync button
    }
  }

  function addKeywordPalette(doc) {
    // Create the TabbedPalette object, of type "script"
    var keywordPalette = new TabbedPalette( doc, "Stock Palette", "KeyUIPalette", "script","right","bottom");
    wrapper.paletteRefs.push(keywordPalette);
    keywordPalette.content.onResize = function() {
      this.layout.resize(true);
      //keywordPalette.content.layout.layout(true);
    }
    var pnl = keywordPalette.content.add("panel", undefined , "");
    wrapper.paletteRefs.push(pnl);
    pnl.margins=[0,0,0,0];
    //pnl.spacing=[0,0,0,0];
    pnl.alignment = ["fill", "fill"];
    // Create a ScriptUI panel to be displayed as the tab contents.
    addSyncPanel(pnl);
    keywordPalette.content.layout.layout();
    keywordPalette.content.layout.resize();
  }

  function addSyncPanel(bar) {
    var staticFile = bar.add( "edittext", undefined, '--',{readonly:true,multiline:true,scrolling: false});
    wrapper.fieldFilenameRefs.push(staticFile);
    staticFile.alignment = ["fill", "top"];
    //app.execMenuItem("Copy");
    var grpFileSizes = bar.add("group");
    grpFileSizes.orientation = "row";
    var staticFile_size = grpFileSizes.add( "statictext", undefined, '--');
    wrapper.fieldFilenameRefs.push(staticFile_size);
    staticFile_size.minimumSize = [200,15];
    var staticFile_dimension = grpFileSizes.add( "statictext", undefined, '--');
    wrapper.fieldFilenameRefs.push(staticFile_dimension);
    staticFile_dimension.minimumSize = [150,15];

    // ADD TITLE
    var TitlePanel = bar.add( "panel", undefined, 'Title', );
    wrapper.panelTitle.push(TitlePanel);
    TitlePanel.maximumSize = [600,48];
    TitlePanel.minimumSize = [355,48];
    TitlePanel.orientation= "row";
    TitlePanel.alignment = ["fill", "top"];
    var editTitleField = TitlePanel.add( "edittext", undefined,"");
    wrapper.editTitleRefs.push(editTitleField);
    editTitleField.alignment = ["fill", "top"];
    editTitleField.onChanging = function(e)
    {
      changeTotalTitle(wrapper.editTitleRefs[0].text.length>0 ? "words: "+ ((wrapper.editTitleRefs[0].text.trim().split(/\s+/)).length) +" | chars: "+ wrapper.editTitleRefs[0].text.length : "words: 0 | chars: 0" );
    }
    var chkSyncTitle = TitlePanel.add( "checkbox", undefined,"");
    wrapper.chkSyncBox.push(chkSyncTitle);
    chkSyncTitle.alignment = ["right", "top"];
    chkSyncTitle.enabled = false;
    // END TITLE

    //ADD DESCR
    var DescrPanel = bar.add( "panel", undefined, 'Description');
    wrapper.panelDesc.push(DescrPanel);
    DescrPanel.maximumSize = [600,80];
    DescrPanel.minimumSize = [355,80];
    DescrPanel.orientation= "row";
    DescrPanel.alignment = ["fill", "fill" ];
    var editDescrField = DescrPanel.add( "edittext", undefined,"",  {multiline:true});
    wrapper.editDescrRefs.push(editDescrField);
    editDescrField.alignment = ["fill", "fill"];
    editDescrField.onChanging = function()
    {
      changeTotalDescr( wrapper.editDescrRefs[0].text.length > 0 ? "words: "+ ((wrapper.editDescrRefs[0].text.trim().split(/\s+/)).length) +" | chars: "+wrapper.editDescrRefs[0].text.length : "words: 0 | chars: 0" );
    }
    var chkSyncDescr = DescrPanel.add( "checkbox", undefined,"");
    wrapper.chkSyncBox.push(chkSyncDescr);
    chkSyncDescr.alignment = ["right", "top"];
    chkSyncDescr.enabled = false;
    //END DESCR

    //ADD KEYWORD
    var KeywordsPanel = bar.add( "panel", undefined, 'Keywords');
    wrapper.panelKeywords.push(KeywordsPanel);
    KeywordsPanel.maximumSize = [600,250];
    KeywordsPanel.minimumSize = [355,150];
    KeywordsPanel.orientation = "row";
    KeywordsPanel.alignment = ["fill", "fill"];
    var editKeywordsField = KeywordsPanel.add( "edittext", undefined,"",  {multiline:true});
    wrapper.editKeywordsRefs.push(editKeywordsField);
    editKeywordsField.alignment = ["fill", "fill"];
    editKeywordsField.onChanging = function()
    {
      changeTotal( wrapper.editKeywordsRefs[0].text.length> 0 ? wrapper.editKeywordsRefs[0].text.split(",").length  : "0" );
    }
    var chkSyncKeywords = KeywordsPanel.add( "checkbox", undefined,"");
    wrapper.chkSyncBox.push(chkSyncKeywords);
    chkSyncKeywords.alignment = ["right", "top"];
    chkSyncKeywords.enabled = false;
    //END KEYWORD

    var grpRow1 = bar.add("group");
    grpRow1.orientation = "row";
    grpRow1.alignment = ["fill", "fill"];
    grpRow1.maximumSize = [600,30];
    grpRow1.minimumSize = [355,30];
    btnSave = grpRow1.add("button", undefined, "Save");
    wrapper.fieldFilenameRefs.push(btnSave);
    btnSync = grpRow1.add("button", undefined, "Sync");
    wrapper.fieldFilenameRefs.push(btnSync);
    var chkAddKeywords = grpRow1.add( "checkbox", undefined,"Add on sync");
    wrapper.chkAddBox.push(chkAddKeywords);
    chkAddKeywords.enabled = true;
    chkAddKeywords.value= false;
    var grpRow2 = bar.add("group");
    grpRow2.orientation = "row";
    grpRow2.alignment = ["fill", "fill"];
    grpRow2.maximumSize = [600,30];
    grpRow2.minimumSize = [355,30];
    btnCopy = grpRow2.add("button", undefined, "Copy");
    wrapper.fieldFilenameRefs.push(btnCopy);
    btnPaste = grpRow2.add("button", undefined, "Paste");
    wrapper.fieldFilenameRefs.push(btnPaste);
    btnPaste.enabled=false;
    btnSave.enabled=false;
    btnCopy .enabled=false;
    btnSync.enabled=false;
    var chkSortKeywords = grpRow2.add( "checkbox", undefined,"Sort keywords");
    wrapper.chkSortBox.push(chkSortKeywords);
    chkSortKeywords.enabled = true;
    chkSortKeywords.value= false;
    btnSave.minimumSize = [110,25];
    btnSync.minimumSize = [110,25];
    btnCopy.minimumSize = [110,25];
    btnPaste.minimumSize = [110,25];
    btnSave.maximumSize = [110,25];
    btnSync.maximumSize = [110,25];
    btnCopy.maximumSize = [110,25];
    btnPaste.maximumSize = [110,25];

    btnSave.onClick = function() {
      if ( app.document.selections.length == 1 ) {
        editTitle = wrapper.editTitleRefs[0];
        new_title = editTitle.text;
        editDescr = wrapper.editDescrRefs[0];
        new_descr = editDescr.text;
        editKeywords =  wrapper.editKeywordsRefs[0];
        new_keywords = editKeywords.text.split(",");
        for (var k  =0 ; k < new_keywords.length; k++)
        {
          new_keywords[k] = new_keywords[k].trim();
        }
        saveMetadata(
          app.document.selections[0],
          new_title,
          new_descr,
          new_keywords,
          {
            sort:wrapper.chkSortBox[0].value,
            append:false
          }
        );
        reselectFiles();
      } else {
        alert("Metadata save only for one file", "Error", errorIcon)
      }
    }

    btnSync.onClick = function() {
      if (!wrapper.chkSyncBox[0].value && !wrapper.chkSyncBox[1].value && !wrapper.chkSyncBox[2].value)
        alert("Please select checkbox");
      else {
        syncMetadata(
          wrapper.masterThumb[0],
          app.document.selections,
          {
            title:wrapper.chkSyncBox[0].value,
            descr:wrapper.chkSyncBox[1].value,
            keywords:wrapper.chkSyncBox[2].value,
            sort:wrapper.chkSortBox[0].value,
            append:wrapper.chkAddBox[0].value
          }
        );
        reselectFiles();
      }
    }

    btnCopy.onClick = function() {
      if (!wrapper.chkSyncBox[0].value && !wrapper.chkSyncBox[1].value && !wrapper.chkSyncBox[2].value)
        alert("Please select checkbox");
      else {
        copyClipboardMetadata(app.document.selections[0]);
        wrapper.flags.clipEmpty = false;
      }
    }

    btnPaste.onClick = function() {
      if (!wrapper.chkSyncBox[0].value && !wrapper.chkSyncBox[1].value && !wrapper.chkSyncBox[2].value)
        alert("Please select checkbox");
      else {
        pasteClipboardMetadata( app.document.selections);
        reselectFiles();
      }
    }
  }

  onDocCreate = function( evt ) {
    if( evt.object.constructor.name == "Document" ) {
      if( evt.type == "create" ) {
        addKeywordPalette(app.document);
        app.eventHandlers.push( { handler: onThumbSelection} );
      }
    }
  }

  onThumbSelection = function( evt ) {
    if (evt.type == "selectionsChanged") {
      if (app.document.selections.length > 0
        && app.document.selections[0].type == "file"
        && app.document.selections[0].hasMetadata == true) {
        ChangePicture();
      } else {
        flushPalette();
      }
    }
    return { handled: false };
   }

  if ($.level == 0 ) {
    for(var i = 0;i < app.documents.length;i++) {
      addKeywordPalette(app.documents[i]);
    }
    app.eventHandlers.push( { handler: onDocCreate } );
  }

  if ($.level == 1 ) {
    addKeywordPalette(app.document);
    app.eventHandlers.push( { handler: onThumbSelection} );
  }
}

KeywordCounter.prototype.canRun = function() {
  if(BridgeTalk.appName == "bridge") return true;
  return false;
}
new KeywordCounter().run();
