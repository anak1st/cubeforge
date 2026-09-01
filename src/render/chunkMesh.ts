/**
 * 把 core/mesher 的原始缓冲转成 three BufferGeometry。
 * 仅做"数据 → GPU 几何"的翻译,mesh 生成逻辑在 core。
 */
import * as THREE from 'three'
import type { MeshData } from '../core/mesher'

export function buildChunkGeometry(data: MeshData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2))
  geo.setIndex(new THREE.BufferAttribute(data.indices, 1))
  return geo
}
