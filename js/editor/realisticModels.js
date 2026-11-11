/* Modelos 3D aprimorados do editor Rocha7.
 * Geometrias compatíveis com Three.js r128; sem dependências externas.
 */
export function createGarmentModel(THREE, modelId, fabricColor) {
  const group = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: fabricColor || "#ffffff", roughness: 0.88, metalness: 0.0, side: THREE.DoubleSide });
  const rib = new THREE.MeshStandardMaterial({ color: fabricColor || "#ffffff", roughness: 0.92, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: 0x263445, roughness: 0.72, side: THREE.DoubleSide });
  const lightTrim = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.58, side: THREE.DoubleSide });
  const stitch = new THREE.MeshStandardMaterial({ color: 0xd9dce1, roughness: 0.9, side: THREE.DoubleSide });

  function addMesh(geometry, material, position, fabricPart = false) {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.fabricPart = fabricPart;
    group.add(mesh);
    return mesh;
  }

  function panel(points, depth = 0.36, z = 0, material = fabric, bevel = 0.035) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, curveSegments: 16,
      bevelEnabled: true, bevelSegments: 4,
      bevelSize: bevel, bevelThickness: bevel
    });
    geometry.translate(0, 0, z - depth / 2);
    return addMesh(geometry, material, null, material === fabric || material === rib);
  }

  function taperedSleeve(side, cuffY) {
    const shoulder = new THREE.Vector3(side * 0.49, 0.62, 0);
    const cuff = new THREE.Vector3(side * 0.91, cuffY, 0);
    const axis = shoulder.clone().sub(cuff);
    const length = axis.length();
    const geometry = new THREE.CylinderGeometry(0.235, 0.155, length, 40, 1, false);
    const sleeve = addMesh(geometry, fabric, [0, 0, 0], true);
    sleeve.position.copy(shoulder.clone().add(cuff).multiplyScalar(0.5));
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());

    const cuffMesh = addMesh(new THREE.CylinderGeometry(0.166, 0.166, 0.12, 40), rib, [0, 0, 0], true);
    cuffMesh.position.copy(cuff);
    cuffMesh.quaternion.copy(sleeve.quaternion);
  }

  const hoodie = modelId === "moletom";
  const torso = hoodie
    ? [[-0.48,0.82],[-0.31,0.94],[-0.16,0.88],[-0.11,0.69],[0.11,0.69],[0.16,0.88],[0.31,0.94],[0.48,0.82],[0.55,0.48],[0.53,-0.94],[-0.53,-0.94],[-0.55,0.48]]
    : [[-0.48,0.82],[-0.31,0.94],[-0.16,0.88],[-0.11,0.69],[0.11,0.69],[0.16,0.88],[0.31,0.94],[0.48,0.82],[0.55,0.48],[0.52,-0.96],[-0.52,-0.96],[-0.55,0.48]];
  panel(torso, hoodie ? 0.40 : 0.36, 0, fabric, 0.045);

  taperedSleeve(-1, hoodie ? -0.66 : -0.20);
  taperedSleeve(1, hoodie ? -0.66 : -0.20);

  if (hoodie) {
    panel([[-0.54,-0.82],[0.54,-0.82],[0.54,-0.99],[-0.54,-0.99]],0.42,0,rib,0.018);
  } else {
    const hem = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.49,-0.87,0.19), new THREE.Vector3(-0.25,-0.90,0.19),
      new THREE.Vector3(0,-0.91,0.19), new THREE.Vector3(0.25,-0.90,0.19),
      new THREE.Vector3(0.49,-0.87,0.19)
    ]);
    addMesh(new THREE.TubeGeometry(hem, 32, 0.009, 6, false), stitch, null, false);
  }

  if (modelId === "polo" || modelId === "football_jersey") {
    panel([[-0.20,0.88],[0,0.72],[0.20,0.88],[0.13,0.61],[0,0.68],[-0.13,0.61]],0.42,0.015,trim,0.018);
    panel([[-0.11,0.69],[0,0.73],[0.11,0.69],[0.075,0.54],[0,0.58],[-0.075,0.54]],0.43,0.02,lightTrim,0.012);

    if (modelId === "polo") {
      addMesh(new THREE.BoxGeometry(0.105,0.40,0.035), lightTrim, [0,0.39,0.215], false);
      [0.53,0.42,0.31].forEach(y => {
        const button = addMesh(new THREE.CylinderGeometry(0.018,0.018,0.018,16), trim, [0,y,0.242], false);
        button.rotation.x = Math.PI / 2;
      });
    } else {
      addMesh(new THREE.BoxGeometry(0.035,0.43,0.025), lightTrim, [0,0.37,0.22], false);
      addMesh(new THREE.BoxGeometry(0.018,0.43,0.012), trim, [0.027,0.37,0.235], false);
      for (let i=0;i<9;i++) addMesh(new THREE.BoxGeometry(0.045,0.012,0.018), trim, [0,0.55-i*0.043,0.24], false);
      [-1,1].forEach(side => addMesh(new THREE.BoxGeometry(0.035,1.05,0.012), lightTrim, [side*0.49,-0.10,0.19], false));
    }
  }

  if (hoodie) {
    panel([[-0.29,0.78],[-0.25,1.08],[-0.16,1.28],[0,1.36],[0.16,1.28],[0.25,1.08],[0.29,0.78],[0.17,0.68],[0,0.75],[-0.17,0.68]],0.48,-0.23,rib,0.045);
    panel([[-0.35,-0.23],[-0.29,-0.61],[-0.20,-0.70],[0.20,-0.70],[0.29,-0.61],[0.35,-0.23],[0.25,-0.17],[-0.25,-0.17]],0.035,0.225,rib,0.018);
    [-1,1].forEach(side => {
      const cord = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side*0.10,0.77,0.25),
        new THREE.Vector3(side*0.13,0.52,0.25),
        new THREE.Vector3(side*0.12,0.36,0.25)
      ]);
      addMesh(new THREE.TubeGeometry(cord,18,0.012,8,false),lightTrim,null,false);
      addMesh(new THREE.SphereGeometry(0.025,12,8),trim,[side*0.12,0.34,0.25],false);
    });
  }
  return group;
}

export function createMugModel(THREE, fabricColor) {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: fabricColor || "#ffffff", roughness: 0.24, metalness: 0, side: THREE.DoubleSide });
  const printMaterial = new THREE.MeshStandardMaterial({ map: null, color: fabricColor || "#ffffff", roughness: 0.30, metalness: 0, side: THREE.DoubleSide });
  function add(geometry, material, position, rotation) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0],position[1],position[2]);
    if (rotation) mesh.rotation.set(rotation[0],rotation[1],rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.fabricPart = true;
    group.add(mesh);
    return mesh;
  }
  add(new THREE.CylinderGeometry(0.68,0.68,1.35,128,1,true),printMaterial,[0,0.05,0]);
  add(new THREE.CylinderGeometry(0.585,0.585,1.20,96,1,true),ceramic,[0,0.05,0]);
  add(new THREE.CylinderGeometry(0.585,0.585,0.045,96),ceramic,[0,-0.535,0]);
  add(new THREE.TorusGeometry(0.665,0.026,16,128),ceramic,[0,0.725,0],[Math.PI/2,0,0]);
  add(new THREE.CylinderGeometry(0.62,0.62,0.09,96),ceramic,[0,-0.64,0]);
  const handlePath = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0.62,0.47,0),
    new THREE.Vector3(1.34,0.58,0),
    new THREE.Vector3(1.34,-0.48,0),
    new THREE.Vector3(0.62,-0.38,0)
  );
  add(new THREE.TubeGeometry(handlePath,64,0.095,20,false),ceramic,[0,0,0]);
  return group;
}
