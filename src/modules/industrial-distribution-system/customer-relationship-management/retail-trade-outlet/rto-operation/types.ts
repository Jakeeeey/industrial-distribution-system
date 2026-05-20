export interface RTOAgent {
  id: string;
  name: string;
  barangay: string;
}

export interface CityDealer {
  id: string;
  name: string;
  assignedPersonnel: RTOAgent[];
  totalFullTanksGivenEver: number;
  totalEmptyTanksReturnedEver: number;
  missingTanks: number;
  unpaidBalance: number;
  createdAt: string;
}
