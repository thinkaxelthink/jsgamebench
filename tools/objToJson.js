#! /usr/bin/env node

// Copyright 2004-present Facebook. All Rights Reserved.

// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

sys = require('sys');
fs = require('fs');
path = require('path');
util = require('util');

Array.prototype.each = function(callback) {
  for (var ii = 0; ii < this.length; ++ii) {
    callback(this[ii], ii);
  }
  return this;
};

Array.prototype.remap = function(callback) {
  for (var ii = 0; ii < this.length; ++ii) {
    this[ii] = callback(this[ii], ii);
  }
  return this;
};

Array.prototype.setSize = function(size, val) {
  for (var ii = 0; ii < size; ++ii) {
    if (this[ii] === undefined) {
      this[ii] = val;
    }
  }
  for (var ii = size; ii < this.length; ++ii) {
    this[ii] = undefined;
  }
  return this;
};

Array.prototype.remove = function(val) {
  var modified = [];
  for (var ii = 0; ii < this.length; ++ii) {
    if (this[ii] !== val) {
      modified.push(this[ii]);
    }
  }
  return modified;
};

function keys(object) {
  var keys = [];
  for (var property in object) {
    keys.push(property);
  }
  return keys;
}

function values(object) {
  var values = [];
  for (var property in object) {
    values.push(object[property]);
  }
  return values;
}

function toInt(val) {
  if (!val) {
    return 0;
  }
  return parseInt(val);
}

function toFloat(val) {
  if (!val) {
    return 0;
  }
  return parseFloat(val);
}

function toIntIndex(val) {
  if (!val) {
    return 0;
  }
  if (val === ' ') {
    return 0;
  }
  return parseInt(val) - 1;
}

function parseObj(filedata) {
  var cur_material = 'default';
  var raw_verts = { 0:[], 1:[], 2:[] };
  var vert_refs = {};
  var inv_vert_refs = [];
  var faces = {};

  var type_sizes = [3,2,3];

  function addVert(type, val) {
    val.setSize(type_sizes[type], '0');
    raw_verts[type].push(val.remap(toFloat));
  }

  function addFace(val) {
    val.setSize(3, '0');

    for (var ii = 0; ii < 3; ++ii) {
      // parse to int and decrement to get 0-based indices
      var vidxs = val[ii].split('/').remap(toIntIndex);
      var vhash = vidxs.setSize(3, 0).join('/');

      if (vert_refs[vhash] === undefined) {
        vert_refs[vhash] = inv_vert_refs.length;
        inv_vert_refs.push(vhash);
      }

      if (!faces[cur_material]) {
        faces[cur_material] = [];
      }
      faces[cur_material].push(vert_refs[vhash]);
    }
  }

  // parse object file and execute its instructions
  filedata.split('\n').each(function(str) {
      if (str.length <= 1) {
        return;
      }
      var params = str.split(' ');
      var cmd = params.shift();
      params = params.remove('');
      switch (cmd) {
        case 'v':
          addVert(0, params);
          break;
        case 'vt':
          addVert(1, params);
          break;
        case 'vn':
          addVert(2, params);
          break;
        case 'f':
          addFace(params);
          break;
        case 'usemtl':
          cur_material = params.join(' ');
          break;
        default:
          break;
      }
    });

  // util.print('Finished parsing\n');

  // explode raw verts into final interleaved form
  var vert_array = [];
  inv_vert_refs.each(function(vhash) {
      var vidx = vhash.split('/').remap(toInt);
      var vert = [];
      for (var ii = 0; ii < 3; ++ii) {
        if (raw_verts[ii].length <= vidx[ii]) {
          raw_verts[ii][vidx[ii]] = [].setSize(type_sizes[ii], 0);
        }
        vert = vert.concat(raw_verts[ii][vidx[ii]]);
      }
      if (vert.length !== 8) {
        throw {name:'Invalid vertex data!'};
      }
      vert_array = vert_array.concat(vert);
    });

  // util.print('Finished interleaving\n');

  // concat face data from each group
  var face_array = [];
  var materials = [];
  var index_counts = [];
  materials = keys(faces);
  materials.sort();
  materials.each(function(material, idx) {
      face_array = face_array.concat(faces[material]);
      index_counts[idx] = faces[material].length;
    });

  // util.print('Finished face sorting\n');

  var ret = {
      verts: vert_array,
      indices: face_array,
      materials: materials,
      counts: index_counts
    };

  return ret;
}

var files = fs.readdirSync('.');
files.each(function(filename) {

    var flen = filename.length;
    if (flen < 5 || filename.slice(-4) !== '.obj') {
      return;
    }

    util.print('\n' + filename + '\n');
    var filedata = fs.readFileSync(filename, 'ascii');
    if (!filedata) {
      util.print('Failed to read file\n');
      return;
    }

    try {
      var modelobj = parseObj(filedata);
    } catch (e) {
      util.print(e.name + '\n');
    }

    if (modelobj) {
      var newFilename = filename.slice(0, -4) + '.json';
      fs.writeFile(newFilename, JSON.stringify(modelobj), function(err) {
          if (err) {
            util.print(err + '\n');
          } else {
            util.print(newFilename + ' saved!\n');
          }
        });
    }
  });

util.print('\n');

