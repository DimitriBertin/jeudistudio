'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import fragmentShaderPosition from '@/shaders/fragmentShaderPosition';
import fragmentShaderVelocity from '@/shaders/fragmentShaderVelocity';
import birdVS from '@/shaders/birdVS'
import birdFS from '@/shaders/birdFS'

const WIDTH = 32;
const BIRDS = WIDTH * WIDTH;


class BirdGeometry extends THREE.BufferGeometry {
  constructor() {
    super();
    const trianglesPerBird = 3;
    const triangles = BIRDS * trianglesPerBird;
    const points = triangles * 3;
    const vertices = new THREE.BufferAttribute( new Float32Array( points * 3 ), 3 );
    const birdColors = new THREE.BufferAttribute( new Float32Array( points * 3 ), 3 );
    const references = new THREE.BufferAttribute( new Float32Array( points * 2 ), 2 );
    const birdVertex = new THREE.BufferAttribute( new Float32Array( points ), 1 );

    this.setAttribute( 'position', vertices );
    this.setAttribute( 'birdColor', birdColors );
    this.setAttribute( 'reference', references );
    this.setAttribute( 'birdVertex', birdVertex );

    let v = 0;

    function verts_push(...points) {
      for ( let i = 0; i < points.length; i ++ ) {
        vertices.array[ v ++ ] = points[ i ];
      }
    }

    const wingsSpan = 20;

    for ( let f = 0; f < BIRDS; f ++ ) {
      verts_push(
        0, - 0, - 20,
        0, 4, - 20,
        0, 0, 30
      );

      // Wings

      verts_push(
        0, 0, - 15,
        - wingsSpan, 0, 0,
        0, 0, 15
      );

      verts_push(
        0, 0, 15,
        wingsSpan, 0, 0,
        0, 0, - 15
      );

    }

    for ( let v = 0; v < triangles * 3; v ++ ) {
      const triangleIndex = ~ ~ ( v / 3 );
      const birdIndex = ~ ~ ( triangleIndex / trianglesPerBird );
      const x = ( birdIndex % WIDTH ) / WIDTH;
      const y = ~ ~ ( birdIndex / WIDTH ) / WIDTH;

      const c = new THREE.Color(
        0x666666 +
        ~ ~ ( v / 9 ) / BIRDS * 0x666666
      );

      birdColors.array[ v * 3 + 0 ] = c.r;
      birdColors.array[ v * 3 + 1 ] = c.g;
      birdColors.array[ v * 3 + 2 ] = c.b;

      references.array[ v * 2 ] = x;
      references.array[ v * 2 + 1 ] = y;

      birdVertex.array[ v ] = v % 9;

    }

    this.scale( 0.1, 0.1, 0.1 );
  }
}

let camera, scene, renderer;
let mouseX = 0, mouseY = 0;

const BOUNDS = 800;

let last = performance.now();

let gpuCompute;
let velocityVariable;
let positionVariable;
let positionUniforms;
let velocityUniforms;
let birdUniforms;


export default function BirdFlock() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  function init() {
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 3000 );
    camera.position.z = 350;

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xffffff );
    scene.fog = new THREE.Fog( 0xffffff, 100, 1000 );

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setAnimationLoop( animate );
    containerRef.current!.appendChild( renderer.domElement );
    initComputeRenderer();

    containerRef.current!.style.touchAction = 'none';
    containerRef.current!.addEventListener( 'pointermove', onPointerMove );


    window.addEventListener( 'resize', onWindowResize );

    initBirds();
  }

  function initComputeRenderer() {
    gpuCompute = new GPUComputationRenderer( WIDTH, WIDTH, renderer );

    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();
    fillPositionTexture( dtPosition );
    fillVelocityTexture( dtVelocity );

    velocityVariable = gpuCompute.addVariable( 'textureVelocity', fragmentShaderVelocity, dtVelocity );
    positionVariable = gpuCompute.addVariable( 'texturePosition', fragmentShaderPosition, dtPosition );

    gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
    gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );

    positionUniforms = positionVariable.material.uniforms;
    velocityUniforms = velocityVariable.material.uniforms;

    positionUniforms[ 'time' ] = { value: 0.0 };
    positionUniforms[ 'delta' ] = { value: 0.0 };
    velocityUniforms[ 'time' ] = { value: 1.0 };
    velocityUniforms[ 'delta' ] = { value: 0.0 };
    velocityUniforms[ 'testing' ] = { value: 1.0 };
    velocityUniforms[ 'separationDistance' ] = { value: 1.0 };
    velocityUniforms[ 'alignmentDistance' ] = { value: 1.0 };
    velocityUniforms[ 'cohesionDistance' ] = { value: 1.0 };
    velocityUniforms[ 'freedomFactor' ] = { value: 1.0 };
    velocityUniforms[ 'predator' ] = { value: new THREE.Vector3() };
    velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed( 2 );

    velocityVariable.wrapS = THREE.RepeatWrapping;
    velocityVariable.wrapT = THREE.RepeatWrapping;
    positionVariable.wrapS = THREE.RepeatWrapping;
    positionVariable.wrapT = THREE.RepeatWrapping;

    const error = gpuCompute.init();

    if ( error !== null ) {

      console.error( error );

    }

  }

  function initBirds() {

    const geometry = new BirdGeometry();

    // For Vertex and Fragment
    birdUniforms = {
      'color': { value: new THREE.Color( 0xff2200 ) },
      'texturePosition': { value: null },
      'textureVelocity': { value: null },
      'time': { value: 1.0 },
      'delta': { value: 0.0 }
    };

    // THREE.ShaderMaterial
    const material = new THREE.ShaderMaterial( {
      uniforms: birdUniforms,
      vertexShader: birdVS,
      fragmentShader: birdFS,
      side: THREE.DoubleSide

    } );

    const birdMesh = new THREE.Mesh( geometry, material );
    birdMesh.rotation.y = Math.PI / 2;
    birdMesh.matrixAutoUpdate = false;
    birdMesh.updateMatrix();

    scene.add( birdMesh );

  }

  function fillPositionTexture( texture ) {

    const theArray = texture.image.data;

    for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {

      const x = Math.random() * (BOUNDS/2) - (BOUNDS/4);
      const y = Math.random() * (BOUNDS/2) - (BOUNDS/4) + 200; // Centré plus haut
      const z = Math.random() * (BOUNDS/2) - (BOUNDS/4) - 200;

      theArray[ k + 0 ] = x;
      theArray[ k + 1 ] = y;
      theArray[ k + 2 ] = z;
      theArray[ k + 3 ] = 1;

    }

  }

  function fillVelocityTexture( texture ) {

    const theArray = texture.image.data;

    for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {

      const x = Math.random() - 0.5;
      const y = Math.random() - 0.5;
      const z = Math.random() - 0.5;

      theArray[ k + 0 ] = x * 10;
      theArray[ k + 1 ] = y * 10;
      theArray[ k + 2 ] = z * 10;
      theArray[ k + 3 ] = 1;

    }

  }

  function onWindowResize() {

    // windowHalfX = window.innerWidth / 2;
    // windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

  }

  function onPointerMove( event ) {

    if ( event.isPrimary === false ) return;

    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;

  }

  function animate() {

    render();

  }

  // Dans birdFlock.tsx, modifiez la fonction render() pour éviter que la souris
// soit réinitialisée à 10000, 10000 après chaque rendu:

  function render() {
    const now = performance.now();
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    let delta = (now - last) / 1000;

    if (delta > 1) delta = 1; // safety cap on large deltas
    last = now;

    positionUniforms['time'].value = now;
    positionUniforms['delta'].value = delta;
    velocityUniforms['time'].value = now;
    velocityUniforms['delta'].value = delta;
    birdUniforms['time'].value = now;
    birdUniforms['delta'].value = delta;

    velocityUniforms['predator'].value.set(0.5 * mouseX / windowHalfX, -0.5 * mouseY / windowHalfY, 0);
    
    // Supprimez ou commentez ces deux lignes pour que la position de la souris
    // persiste entre les rendus:
    // mouseX = 10000;
    // mouseY = 10000;

    gpuCompute.compute();

    birdUniforms['texturePosition'].value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
    birdUniforms['textureVelocity'].value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture;

    renderer.render(scene, camera);
  }


  useEffect(() => {
    if(!containerRef.current) return 

    init()
  }, [containerRef])

  return (
    <div ref={containerRef} className="canvas" />
  );
}