/* =================================================================== */
/*  Site plan (metres, Y up). Main street runs along Z.                */
/*                                                                     */
/*        z=-130 … north (distant skyline, landmark spire)             */
/*        z=-44 … -32  cross street, maglev overhead (y≈16)            */
/*   WEST (x<0)                         EAST (x>0)                     */
/*   Hoshino Megablock  z -32…-2        Parking tower   z -32…-14      */
/*   Shophouse row      z  -2…40        KOI-TEI tower   z -14…4        */
/*                                       Back alley     z   4…9        */
/*                                       Game arcade    z   9…40       */
/*        z=+18  default camera (pedestrian eye height)                */
/* =================================================================== */
export const L = {
  roadHalf: 5,
  curbH: 0.18,
  eastX: 7.5,
  westX: -7.5,
  hero: { x0: 7.5, x1: 21.5, z0: -14, z1: 4 },
  alley: { z0: 4, z1: 9, x1: 34 },
  parking: { x0: 7.5, x1: 22, z0: -32, z1: -14 },
  arcade: { x0: 7.5, x1: 24, z0: 9, z1: 40 },
  mega: { x0: -30, x1: -7.5, z0: -32, z1: -2 },
  shop: { x0: -24, x1: -7.5, z0: -2, z1: 40 },
  cross: { z0: -44, z1: -32, roadZ0: -41.5, roadZ1: -34.5 },
  maglev: { z: -38, y: 16 },
};
