declare module "dxf" {
  export class Helper {
    constructor(contents: string);
    readonly denormalised: Array<{ layer?: string }>;
    toPolylines(): { polylines: Array<{ vertices: Array<[number, number]>; layer?: { name?: string } | null }> };
  }
}
