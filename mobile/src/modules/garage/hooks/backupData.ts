/**
 * Seed/default data for the garage module — vehicle list, fuel fills and
 * maintenance logs used on first-time app launch.
 */
import type { FuelFill, MaintenanceLog } from "../store";

export const BACKUP_VEHICLES: string[] = ["Jupiter 125"];

export const BACKUP_FILLS: FuelFill[] = [
  {"id":"3","vehicle":"Jupiter 125","date":"2026-05-24T18:30:00.000Z","amount":33037,"liters":2.81,"pricePerLiter":11757,"odometer":260,"station":"BPCL Hafeezpet","note":""},
  {"id":"4","vehicle":"Jupiter 125","date":"2026-05-30T18:30:00.000Z","amount":47969,"liters":4.08,"pricePerLiter":11757,"odometer":418,"station":"BPCL HAFEEZPET","note":""},
  {"id":"5","vehicle":"Jupiter 125","date":"2026-06-02T18:30:00.000Z","amount":38386,"liters":3.32,"pricePerLiter":11562,"odometer":586,"station":"HPCL Kondapur","note":"Avg 56km/l"},
  {"id":"6","vehicle":"Jupiter 125","date":"2026-06-05T18:30:00.000Z","amount":42317,"liters":3.66,"pricePerLiter":11562,"odometer":775,"station":"HPCL Kondapur","note":""},
  {"id":"8","vehicle":"Jupiter 125","date":"2026-06-09T18:30:00.000Z","amount":27518,"liters":2.38,"pricePerLiter":11562,"odometer":889,"station":"HPCL Kondapur","note":"Very less mileage due to traffic"},
  {"id":"9","vehicle":"Jupiter 125","date":"2026-06-11T18:30:00.000Z","amount":25752,"liters":2.22,"pricePerLiter":11600,"odometer":1001,"station":"HPCL MOINABAD","note":""},
  {"id":"10","vehicle":"Jupiter 125","date":"2026-06-13T18:30:00.000Z","amount":38733,"liters":3.35,"pricePerLiter":11562,"odometer":1165,"station":"HPCL KONDAPUR","note":"Good mileage"},
  {"id":"11","vehicle":"Jupiter 125","date":"2026-06-21T18:30:00.000Z","amount":38860,"liters":3.35,"pricePerLiter":11600,"odometer":1339,"station":"HPCL MOINABAD","note":""},
  {"id":"12","vehicle":"Jupiter 125","date":"2026-06-30T18:30:00.000Z","amount":34802,"liters":3.01,"pricePerLiter":11562,"odometer":1509,"station":"HPCL KONDAPUR","note":""},
  {"id":"13","vehicle":"Jupiter 125","date":"2026-07-02T18:30:00.000Z","amount":22430,"liters":1.94,"pricePerLiter":11562,"odometer":1605,"station":"HPCL KONDAPUR","note":""},
  {"id":"14","vehicle":"Jupiter 125","date":"2026-07-05T18:30:00.000Z","amount":34096,"liters":2.949,"pricePerLiter":11562,"odometer":1750,"station":"HPCL KONDAPUR","note":""},
  {"id":"16","vehicle":"Jupiter 125","date":"2026-07-12T18:30:00.000Z","amount":35611,"liters":3.08,"pricePerLiter":11562,"odometer":1905,"station":"HPCL KONDAPUR","note":""},
  {"id":"19","vehicle":"Jupiter 125","date":"2026-07-19T00:00:00.000Z","amount":38270,"liters":3.31,"pricePerLiter":11562,"odometer":2081,"station":"HPCL Kondapur","note":""},
];

export const BACKUP_MAINTENANCE: MaintenanceLog[] = [];
