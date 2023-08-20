"use strict";

// This is not a full .obj parser.
// see http://paulbourke.net/dataformats/obj/

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];
  const objColors = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
    objColors,
  ];

  // same order as `f` indices
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
    [],   // colors
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => {};

  function newGeometry() {
    // If there is an existing geometry and it's
    // not empty then start a new one.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      const color = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
        color,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
          color,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
      // if this is the position index (index 0) and we parsed
      // vertex colors then copy the vertex colors to the webgl vertex color data
      if (i === 0 && objColors.length > 1) {
        geometry.data.color.push(...objColors[index]);
      }
    });
  }

  const keywords = {
    v(parts) {
      // if there are more than 3 values here they are vertex colors
      if (parts.length > 3) {
        objPositions.push(parts.slice(0, 3).map(parseFloat));
        objColors.push(parts.slice(3).map(parseFloat));
      } else {
        objPositions.push(parts.map(parseFloat));
      }
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts) {
      // the spec says there can be multiple file here
      // but I found one with a space in the filename
      // materialLibs.push(parts.join(' '));
      materialLibs.push(parts.join(' '));

    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // remove any arrays that have no entries.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }

  return {
    geometries,
    materialLibs,
  };
}

function parseMapArgs(unparsedArgs) {
  // TODO: handle options
  return unparsedArgs;
}

function parseMTL(text) {
  const materials = {};
  let material;

  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    /* eslint brace-style:0 */
    Ns(parts)       { material.shininess      = parseFloat(parts[0]); },
    Ka(parts)       { material.ambient        = parts.map(parseFloat); },
    Kd(parts)       { material.diffuse        = parts.map(parseFloat); },
    Ks(parts)       { material.specular       = parts.map(parseFloat); },
    Ke(parts)       { material.emissive       = parts.map(parseFloat); },
    map_Kd(parts, unparsedArgs)   { material.diffuseMap = parseMapArgs(unparsedArgs); },
    map_Ns(parts, unparsedArgs)   { material.specularMap = parseMapArgs(unparsedArgs); },
    map_Bump(parts, unparsedArgs) { material.normalMap = parseMapArgs(unparsedArgs); },
    Ni(parts)       { material.opticalDensity = parseFloat(parts[0]); },
    d(parts)        { material.opacity        = parseFloat(parts[0]); },
    illum(parts)    { material.illum          = parseInt(parts[0]); },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}

function makeIndexIterator(indices) {
  let ndx = 0;
  const fn = () => indices[ndx++];
  fn.reset = () => { ndx = 0; };
  fn.numElements = indices.length;
  return fn;
}

function makeUnindexedIterator(positions) {
  let ndx = 0;
  const fn = () => ndx++;
  fn.reset = () => { ndx = 0; };
  fn.numElements = positions.length / 3;
  return fn;
}

const subtractVector2 = (a, b) => a.map((v, ndx) => v - b[ndx]);

function generateTangents(position, texcoord, indices) {
  const getNextIndex = indices ? makeIndexIterator(indices) : makeUnindexedIterator(position);
  const numFaceVerts = getNextIndex.numElements;
  const numFaces = numFaceVerts / 3;

  const tangents = [];
  for (let i = 0; i < numFaces; ++i) {
    const n1 = getNextIndex();
    const n2 = getNextIndex();
    const n3 = getNextIndex();

    const p1 = position.slice(n1 * 3, n1 * 3 + 3);
    const p2 = position.slice(n2 * 3, n2 * 3 + 3);
    const p3 = position.slice(n3 * 3, n3 * 3 + 3);

    const uv1 = texcoord.slice(n1 * 2, n1 * 2 + 2);
    const uv2 = texcoord.slice(n2 * 2, n2 * 2 + 2);
    const uv3 = texcoord.slice(n3 * 2, n3 * 2 + 2);

    const dp12 = m4.subtractVectors(p2, p1);
    const dp13 = m4.subtractVectors(p3, p1);

    const duv12 = subtractVector2(uv2, uv1);
    const duv13 = subtractVector2(uv3, uv1);


    const f = 1.0 / (duv12[0] * duv13[1] - duv13[0] * duv12[1]);
    const tangent = Number.isFinite(f)
      ? m4.normalize(m4.scaleVector(m4.subtractVectors(
          m4.scaleVector(dp12, duv13[1]),
          m4.scaleVector(dp13, duv12[1]),
        ), f))
      : [1, 0, 0];

    tangents.push(...tangent, ...tangent, ...tangent);
  }

  return tangents;
}

async function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // Tell the twgl to match position with a_position etc..
  twgl.setAttributePrefix("a_");

  const vs = `#version 300 es
  in vec4 a_position;
  in vec3 a_normal;
  in vec3 a_tangent;
  in vec2 a_texcoord;
  in vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  out vec3 v_normal;
  out vec3 v_tangent;
  out vec3 v_surfaceToView;
  out vec2 v_texcoord;
  out vec4 v_color;

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;

    mat3 normalMat = mat3(u_world);
    v_normal = normalize(normalMat * a_normal);
    v_tangent = normalize(normalMat * a_tangent);

    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;

  const fs = `#version 300 es
  precision highp float;

  in vec3 v_normal;
  in vec3 v_tangent;
  in vec3 v_surfaceToView;
  in vec2 v_texcoord;
  in vec4 v_color;

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform sampler2D specularMap;
  uniform float shininess;
  uniform sampler2D normalMap;
  uniform float opacity;
  uniform vec3 u_lightDirection;
  uniform vec3 u_ambientLight;

  out vec4 outColor;

  void main () {
    vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 bitangent = normalize(cross(normal, tangent));

    mat3 tbn = mat3(tangent, bitangent, normal);
    normal = texture(normalMap, v_texcoord).rgb * 2. - 1.;
    normal = normalize(tbn * normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
    vec4 specularMapColor = texture(specularMap, v_texcoord);
    vec3 effectiveSpecular = specular * specularMapColor.rgb;

    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    outColor = vec4(
        emissive +
        ambient * u_ambientLight +
        effectiveDiffuse * fakeLight +
        effectiveSpecular * pow(specularLight, shininess),
        effectiveOpacity);
  }
  `;

  // Testeeee Inicio
  // var objects = [
  //   sunNode,
  //   earthNode,
  //   moonNode,
  // ];

  // var objectsToDraw = [
  //   sunNode.drawInfo,
  //   earthNode.drawInfo,
  //   moonNode.drawInfo,
  // ];

  var sliderPositions = {
    X: 0,
    Y: 0,
    Z: 0,
    R: 0,
    T: 0,
    tempo: 0
  }

  // 10xvalor
  // const points = {
  //   P0: [10, 0, 26],
  //   P1: [2, 0, 23],
  //   P2: [2, 0, 9],
  //   P3: [8, -5, 2], // controle
  //   P4: [14, -10, -5],
  //   P5: [8, -5, -15],
  //   P6: [0, -5, -15], // controle
  //   P7: [-7, -5, -15],
  //   P8: [-18, -10, -11],
  //   P9: [-24, -15, 3], // controle
  //   P10: [-29, -20, 18],
  //   P11: [-21, -15, 39],
  //   P12: [-8, -10, 22],
  // };

  // const secondObjPoints = {
  //   P0: [100, 25, -90],
  //   P1: [-20, 0, -50],
  //   P2: [-90, 0, -10],
  //   P3: [30, 15, 20],
  // };

  const points = {
    P0: [100, 0, 260],
    P1: [20, 0, 230],
    P2: [20, 0, 90],
    P3: [80, -50, 20], // controle
    P4: [140, -100, -50],
    P5: [80, -50, -150],
    P6: [0, -50, -150], // controle
    P7: [-70, -50, -150],
    P8: [-180, -100, -110],
    P9: [-240, -150, 30], // controle
    P10: [-290, -200, 180],
    P11: [-210, -150, 390],
    P12: [-80, -100, 220],
  };

  const secondObjPoints = {
    P0: [1000, 250, -900],
    P1: [-200, 0, -500],
    P2: [-900, 0, -100],
    P3: [300, 150, 200],
  };

  function secondCalculatePoint(secondObjPoints, t) {
    const startIndex = 0;
    const X = secondObjPoints[`P${startIndex}`];
    const Y = secondObjPoints[`P${startIndex + 1}`];
    const Z = secondObjPoints[`P${startIndex + 2}`];
    const W = secondObjPoints[`P${startIndex + 3}`];

    const A = X.map((coord, index) => coord + t * (Y[index] - coord));
    const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
    const C = Z.map((coord, index) => coord + t * (W[index] - coord));

    const AB = A.map((coord, index) => coord + t * (B[index] - coord));
    const BC = B.map((coord, index) => coord + t * (C[index] - coord));

    const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

    // return ABC.map(element => 10* + element);
    return ABC;
  }

  function calculatePoint(points, t) {
    if (t <= 0.25) {
      t *= 4;
      if (t==1) {
        t-= 0.001;
      }
      const startIndex = 0;
      const X = points[`P${startIndex}`];
      const Y = points[`P${startIndex + 1}`];
      const Z = points[`P${startIndex + 2}`];
      const W = points[`P${startIndex + 3}`];

      const A = X.map((coord, index) => coord + t * (Y[index] - coord));
      const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
      const C = Z.map((coord, index) => coord + t * (W[index] - coord));

      const AB = A.map((coord, index) => coord + t * (B[index] - coord));
      const BC = B.map((coord, index) => coord + t * (C[index] - coord));

      const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

      return ABC;
    } else if (t > 0.25 && t <= 0.5) {
      t -= 0.25;
      t *= 4;
      if (t==1) {
        t-= 0.001;
      }
      const startIndex = 3;
      const X = points[`P${startIndex}`];
      const Y = points[`P${startIndex + 1}`];
      const Z = points[`P${startIndex + 2}`];
      const W = points[`P${startIndex + 3}`];

      const A = X.map((coord, index) => coord + t * (Y[index] - coord));
      const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
      const C = Z.map((coord, index) => coord + t * (W[index] - coord));

      const AB = A.map((coord, index) => coord + t * (B[index] - coord));
      const BC = B.map((coord, index) => coord + t * (C[index] - coord));

      const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

      return ABC;
    } else if (t > 0.5 && t <= 0.75) {
      t -= 0.5;
      t *= 4;
      if (t==1) {
        t-= 0.001;
      }
      const startIndex = 6;
      const X = points[`P${startIndex}`];
      const Y = points[`P${startIndex + 1}`];
      const Z = points[`P${startIndex + 2}`];
      const W = points[`P${startIndex + 3}`];

      const A = X.map((coord, index) => coord + t * (Y[index] - coord));
      const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
      const C = Z.map((coord, index) => coord + t * (W[index] - coord));

      const AB = A.map((coord, index) => coord + t * (B[index] - coord));
      const BC = B.map((coord, index) => coord + t * (C[index] - coord));

      const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

      return ABC;
    } else {
      t -= 0.75;
      t *= 4;
      if (t==1) {
        t-= 0.001;
      }
      const startIndex = 9;
      const X = points[`P${startIndex}`];
      const Y = points[`P${startIndex + 1}`];
      const Z = points[`P${startIndex + 2}`];
      const W = points[`P${startIndex + 3}`];

      const A = X.map((coord, index) => coord + t * (Y[index] - coord));
      const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
      const C = Z.map((coord, index) => coord + t * (W[index] - coord));

      const AB = A.map((coord, index) => coord + t * (B[index] - coord));
      const BC = B.map((coord, index) => coord + t * (C[index] - coord));

      const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

      return ABC;
    }
  }

  function addNegativeValues(vector) {
    return vector.map(element => - + element);
  }

  function calculateTangent(points, t) {
    // const i = t;
    if (t <= 0.25) {
      t *= 4;
      const startIndex = 0;
      const X = points[`P${startIndex}`];
      const Y = points[`P${startIndex + 1}`];
      const Z = points[`P${startIndex + 2}`];
      const W = points[`P${startIndex + 3}`];

      const A = X.map((coord, index) => coord + t * (Y[index] - coord));
      const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
      const C = Z.map((coord, index) => coord + t * (W[index] - coord));

      const AB = A.map((coord, index) => coord + t * (B[index] - coord));
      const BC = B.map((coord, index) => coord + t * (C[index] - coord));

      return BC;
      
      // if (i > p) {
      //   return BC;
      // } else {
      //   return AB;
      // }
    } else if (t > 0.25 && t <= 0.5) {
      t -= 0.25;
      t *= 4;
      const startIndex = 3;
      const X = points[`P${startIndex}`];
      const Y = points[`P${startIndex + 1}`];
      const Z = points[`P${startIndex + 2}`];
      const W = points[`P${startIndex + 3}`];

      const A = X.map((coord, index) => coord + t * (Y[index] - coord));
      const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
      const C = Z.map((coord, index) => coord + t * (W[index] - coord));

      const AB = A.map((coord, index) => coord + t * (B[index] - coord));
      const BC = B.map((coord, index) => coord + t * (C[index] - coord));

      return BC;
    } else if (t > 0.5 && t <= 0.75) {
      t -= 0.5;
      t *= 4;
      const startIndex = 6;
      const X = points[`P${startIndex}`];
      const Y = points[`P${startIndex + 1}`];
      const Z = points[`P${startIndex + 2}`];
      const W = points[`P${startIndex + 3}`];

      const A = X.map((coord, index) => coord + t * (Y[index] - coord));
      const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
      const C = Z.map((coord, index) => coord + t * (W[index] - coord));

      const AB = A.map((coord, index) => coord + t * (B[index] - coord));
      const BC = B.map((coord, index) => coord + t * (C[index] - coord));

      return BC;
    } else {
      t -= 0.75;
      t *= 4;
      const startIndex = 9;
      const X = points[`P${startIndex}`];
      const Y = points[`P${startIndex + 1}`];
      const Z = points[`P${startIndex + 2}`];
      const W = points[`P${startIndex + 3}`];

      const A = X.map((coord, index) => coord + t * (Y[index] - coord));
      const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
      const C = Z.map((coord, index) => coord + t * (W[index] - coord));

      const AB = A.map((coord, index) => coord + t * (B[index] - coord));
      const BC = B.map((coord, index) => coord + t * (C[index] - coord));

      return BC;
    }
  }
  // Testeeee Final

  // webglLessonsUI.setupSlider("#x", {slide: updatePosition(0), min:-500, max: 500});
  // webglLessonsUI.setupSlider("#y", {slide: updatePosition(1), min:-500, max: 500});
  // webglLessonsUI.setupSlider("#z", {slide: updatePosition(2), min:-500, max: 500});
  // webglLessonsUI.setupSlider("#r", {slide: updatePosition(3), min: 0, max: 1, step: 0.001, precision: 3});

  // function updatePosition(index) {
  //   return function(event, ui) {
  //     cameraTarget[index] = ui.value;
  //   };
  // }

  webglLessonsUI.setupSlider("#r", {min: 0, max: 1, step: 0.001, precision: 3});
  webglLessonsUI.setupSlider("#tempo", {min: 0, max: 60, step: 0.1, precision: 1});


  // compiles and links the shaders, looks up attribute and uniform locations
  const meshProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);

  const objHref = './source/Island/island.obj';
  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);
  const baseHref = new URL(objHref, window.location.href);
  const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
    const matHref = new URL(filename, baseHref).href;
    const response = await fetch(matHref);
    return await response.text();
  }));
  const materials = parseMTL(matTexts.join('\n'));

  const textures = {
    defaultWhite: twgl.createTexture(gl, {src: [255, 255, 255, 255]}),
    defaultNormal: twgl.createTexture(gl, {src: [127, 127, 255, 0]}),
  };

  // load texture for materials
  for (const material of Object.values(materials)) {
    Object.entries(material)
      .filter(([key]) => key.endsWith('Map'))
      .forEach(([key, filename]) => {
        let texture = textures[filename];
        if (!texture) {
          const textureHref = new URL(filename, baseHref).href;
          texture = twgl.createTexture(gl, {src: textureHref, flipY: true});
          textures[filename] = texture;
        }
        material[key] = texture;
      });
  }

  //Test sec
  // const secondObjHref = './source/Helicopter-Yellow/EuroCompter.obj';
  const secondObjHref = './source/Drone/drone.obj';
  const secondObjResponse = await fetch(secondObjHref);
  const secondObjText = await secondObjResponse.text();
  const secondObj = parseOBJ(secondObjText);
  const secondBaseHref = new URL(secondObjHref, window.location.href);
  const secondMatTexts = await Promise.all(
      secondObj.materialLibs.map(async (filename) => {
          const matHref = new URL(filename, secondBaseHref).href;
          const response = await fetch(matHref);
          return await response.text();
      })
  );

  const secondMaterials = parseMTL(secondMatTexts.join("\n"));

  for (const material of Object.values(secondMaterials)) {
      Object.entries(material)
          .filter(([key]) => key.endsWith("Map"))
          .forEach(([key, filename]) => {
              let texture = textures[filename];
              if (!texture) {
                  const textureHref = new URL(filename, secondBaseHref).href;
                  texture = twgl.createTexture(gl, { src: textureHref, flipY: true });
                  textures[filename] = texture;
              }
              material[key] = texture;
          });
  }
  //test

  // hack the materials so we can see the specular map
  Object.values(materials).forEach(m => {
    m.shininess = 500;
    m.specular = [3, 2, 1];
  });

  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: textures.defaultWhite,
    normalMap: textures.defaultNormal,
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    specularMap: textures.defaultWhite,
    shininess: 400,
    opacity: 1,
  };

  const parts = obj.geometries.map(({material, data}) => {
    // Because data is just named arrays like this
    //
    // {
    //   position: [...],
    //   texcoord: [...],
    //   normal: [...],
    // }
    //
    // and because those names match the attributes in our vertex
    // shader we can pass it directly into `createBufferInfoFromArrays`
    // from the article "less code more fun".

    if (data.color) {
      if (data.position.length === data.color.length) {
        // it's 3. The our helper library assumes 4 so we need
        // to tell it there are only 3.
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      // there are no vertex colors so just use constant white
      data.color = { value: [1, 1, 1, 1] };
    }

    // generate tangents if we have the data to do so.
    if (data.texcoord && data.normal) {
      data.tangent = generateTangents(data.position, data.texcoord);
    } else {
      // There are no tangents
      data.tangent = { value: [1, 0, 0] };
    }

    if (!data.texcoord) {
      data.texcoord = { value: [0, 0] };
    }

    if (!data.normal) {
      // we probably want to generate normals if there are none
      data.normal = { value: [0, 0, 1] };
    }

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
      vao,
    };
  });

  //test sec
  const secondParts = secondObj.geometries.map(({material, data}) => {
    if (data.color) {
      if (data.position.length === data.color.length) {
        // it's 3. The our helper library assumes 4 so we need
        // to tell it there are only 3.
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      // there are no vertex colors so just use constant white
      data.color = { value: [1, 1, 1, 1] };
    }

    // generate tangents if we have the data to do so.
    if (data.texcoord && data.normal) {
      data.tangent = generateTangents(data.position, data.texcoord);
    } else {
      // There are no tangents
      data.tangent = { value: [1, 0, 0] };
    }

    if (!data.texcoord) {
      data.texcoord = { value: [0, 0] };
    }

    if (!data.normal) {
      // we probably want to generate normals if there are none
      data.normal = { value: [0, 0, 1] };
    }

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
    return {
        material: {
            ...defaultMaterial,
            ...secondMaterials[material],
        },
        bufferInfo,
        vao,
    };
  });
  //test

  function getExtents(positions) {
    const min = positions.slice(0, 3);
    const max = positions.slice(0, 3);
    for (let i = 3; i < positions.length; i += 3) {
      for (let j = 0; j < 3; ++j) {
        const v = positions[i + j];
        min[j] = Math.min(v, min[j]);
        max[j] = Math.max(v, max[j]);
      }
    }
    return {min, max};
  }

  function getGeometriesExtents(geometries) {
    return geometries.reduce(({min, max}, {data}) => {
      const minMax = getExtents(data.position);
      return {
        min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
        max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
      };
    }, {
      min: Array(3).fill(Number.POSITIVE_INFINITY),
      max: Array(3).fill(Number.NEGATIVE_INFINITY),
    });
  }

  // Sliders 
  // sliderPositions.X = document.querySelector('#x .gman-widget-value').textContent;
  // sliderPositions.Y = document.querySelector('#y .gman-widget-value').textContent;
  // sliderPositions.Z = document.querySelector('#z .gman-widget-value').textContent;
  sliderPositions.R = document.querySelector('#r .gman-widget-value').textContent;
  sliderPositions.tempo = document.querySelector('#r .gman-widget-value').textContent;

  sliderPositions.T = sliderPositions.R;

  //sliders

  const extents = getGeometriesExtents(obj.geometries);
  const range = m4.subtractVectors(extents.max, extents.min);
  // amount to move the object so its center is at the origin
  const objOffset = m4.scaleVector(
      m4.addVectors(
        extents.min,
        m4.scaleVector(range, 0.5)),
      -1);
  const cameraTarget = calculateTangent(points, sliderPositions.R);
  // figure out how far away to move the camera so we can likely
  // see the object.
  // const radius = m4.length(range) * 0.5;
  const cameraPosition = m4.addVectors(cameraTarget, calculatePoint(points, sliderPositions.R));
  // const cameraPosition = calculatePoint(points, sliderPositions.R);
  // Set zNear and zFar to something hopefully appropriate
  // for the size of this object.
  // const zNear = radius / 100;
  // const zFar = radius * 3;

  const zNear = 0.1;
  const zFar = 500;

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function updatePosition() {
    // const cameraTarget = calculateTangent(points, r);
    const cameraPosition = calculatePoint(points, sliderPositions.R);
    // return cameraPosition;
    // requestAnimationFrame(render);
  }

  let secondObjTime = 0;

  function render(time) {
    time *= 0.001;  // convert to seconds

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    // if (sliderPositions.T != sliderPositions.R) {
    //   sliderPositions.T = sliderPositions.R;
    // };

    sliderPositions.R = document.querySelector('#r .gman-widget-value').textContent;
    sliderPositions.tempo = document.querySelector('#r .gman-widget-value').textContent;
    const cameraTarget = calculateTangent(points, sliderPositions.R);
    const cameraPosition = calculatePoint(points, sliderPositions.R);
    // const cadeiraPosition = calculatePoint(points, sliderPositions.R);

    const up = [0, 1, 0];
    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
    };

    gl.useProgram(meshProgramInfo.program);

    // calls gl.uniform
    twgl.setUniforms(meshProgramInfo, sharedUniforms);

    // compute the world matrix once since all parts
    // are at the same space.
    let u_world = m4.yRotation(0);
    u_world = m4.translate(u_world, ...objOffset);
    
    for (const {bufferInfo, vao, material} of parts) {
      // set the attributes for this part.
      gl.bindVertexArray(vao);
      // calls gl.uniform
      twgl.setUniforms(meshProgramInfo, {
        u_world,
      }, material);
      // calls gl.drawArrays or gl.drawElements
      twgl.drawBufferInfo(gl, bufferInfo);
    }

    //Teste sec
    secondObjTime += 0.01;

    // const extents = getGeometriesExtents(obj.geometries);
    // const range = m4.subtractVectors(extents.max, extents.min);
    // // amount to move the object so its center is at the origin
    // const objOffset = m4.scaleVector(
    //   m4.addVectors(
    //     extents.min,
    //     m4.scaleVector(range, 0.5)),
    // -1);

    // Render the second object
    for (const { bufferInfo, vao, material } of secondParts) {
      const scaledUWorld = m4.scale(u_world, 1, 1, 1);
      // const xOffset = Math.sin(secondObjTime) * 35;
      // const xOffset = addNegativeValues(secondCalculatePoint(secondObjPoints, sliderPositions.R));
      const xOffset = secondCalculatePoint(secondObjPoints, sliderPositions.R);
      const initialX = 80; // Coloque um valor aqui para ajustar a posição ao longo do eixo X
      const initialY = 60; // Coloque um valor aqui para ajustar a posição ao longo do eixo Y
      // const initialZ = 220; // Coloque um valor aqui para ajustar a posição ao longo do eixo Z
      // -8, -10, 22 | [10, 0, 26];


      // const translatedUWorld = m4.translate(scaledUWorld, initialX, initialY, xOffset);
      const translatedUWorld = m4.translate(scaledUWorld, ...xOffset);

      gl.bindVertexArray(vao);
      twgl.setUniforms(
          meshProgramInfo,
          {
              u_world: translatedUWorld,
          },
          material
      );
      twgl.drawBufferInfo(gl, bufferInfo);
    }
    //TESTE

    // // Start animation button
    // const startAnimateButton = document.getElementById("startAnimateButton");
    // startAnimateButton.addEventListener("click", startCameraAnimation);

    // // Stop animation button
    // const stopAnimateButton = document.getElementById("stopAnimateButton");
    // stopAnimateButton.addEventListener("click", stopCameraAnimation);
    
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();