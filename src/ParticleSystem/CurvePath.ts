import * as THREE from 'three';

export function getTestPoints(): THREE.Vector3[] {
  // Создаем точки для спирали
  const points: THREE.Vector3[] = [];
  const turns = 3; // количество витков
  const pointsPerTurn = 20; // точек на виток

  for (let i = 0; i <= turns * pointsPerTurn; i++) {
    const t = i / pointsPerTurn;
    const angle = t * Math.PI * 2;
    const radius = 1; // радиус спирали
    const height = t * 2; // высота подъема

    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    ));

  }
  return points;
}

export class CurvePath {
  private curve: THREE.CatmullRomCurve3;
  private target: THREE.Vector3;

  constructor(points: THREE.Vector3[]) {
    this.curve = new THREE.CatmullRomCurve3(points);
    this.target = new THREE.Vector3();
  }

  getPoint(t: number): THREE.Vector3 {
    return this.curve.getPoint(t, this.target);
  }

  getTangent(t: number): THREE.Vector3 {
    return this.curve.getTangent(t, this.target);
  }
}