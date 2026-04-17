import { Communes, Districts, Provinces } from "vietnam-divisions-js";

export type AdministrativeOption = {
  code: string;
  name: string;
};

let provincesCache: Promise<AdministrativeOption[]> | null = null;
let districtsCache: Promise<
  Array<{ idProvince: string; idDistrict: string; name: string }>
> | null = null;
let communesCache: Promise<
  Array<{ idDistrict: string; idCommune: string; name: string }>
> | null = null;

export async function getProvinces(): Promise<AdministrativeOption[]> {
  if (!provincesCache) {
    provincesCache = Provinces.getAllProvince().then((items) =>
      items.map((item) => ({ code: item.idProvince, name: item.name })),
    );
  }

  return provincesCache;
}

async function getAllDistricts(): Promise<
  Array<{ idProvince: string; idDistrict: string; name: string }>
> {
  if (!districtsCache) {
    districtsCache = Districts.getAllDistricts();
  }

  return districtsCache;
}

async function getAllCommunes(): Promise<
  Array<{ idDistrict: string; idCommune: string; name: string }>
> {
  if (!communesCache) {
    communesCache = Communes.getAllCommunes();
  }

  return communesCache;
}

export async function getDistrictsByProvinceCode(
  provinceCode: string,
): Promise<AdministrativeOption[]> {
  const safeCode = String(provinceCode || "").trim();
  if (!safeCode) return [];

  const districts = await getAllDistricts();
  return districts
    .filter((item) => item.idProvince === safeCode)
    .map((item) => ({ code: item.idDistrict, name: item.name }));
}

export async function getWardsByDistrictCode(
  districtCode: string,
): Promise<AdministrativeOption[]> {
  const safeCode = String(districtCode || "").trim();
  if (!safeCode) return [];

  const communes = await getAllCommunes();
  return communes
    .filter((item) => item.idDistrict === safeCode)
    .map((item) => ({ code: item.idCommune, name: item.name }));
}
