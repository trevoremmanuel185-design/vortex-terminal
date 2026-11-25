import type { ContractType } from "./types";

/** Indicative return rates used by simulation + backtester (not live quotes). */
export function returnRate(contractType: ContractType): number {
  switch (contractType) {
    case "CALL":
    case "PUT":
    case "ASIANU":
    case "ASIAND":
      return 0.942;
    case "DIGITEVEN":
    case "DIGITODD":
      return 0.952;
    case "DIGITMATCH":
      return 7.2;
    case "DIGITDIFF":
      return 0.088;
    case "DIGITOVER":
    case "DIGITUNDER":
      return 0.58;
    case "MULTUP":
    case "MULTDOWN":
      return 0.9;
    default:
      return 0.9;
  }
}

export const CONTRACT_LABELS: Record<ContractType, string> = {
  CALL: "Rise",
  PUT: "Fall",
  ASIANU: "Higher",
  ASIAND: "Lower",
  DIGITMATCH: "Matches",
  DIGITDIFF: "Differs",
  DIGITEVEN: "Even",
  DIGITODD: "Odd",
  DIGITOVER: "Over",
  DIGITUNDER: "Under",
  MULTUP: "Multiplier Up",
  MULTDOWN: "Multiplier Down",
};

export function contractSentence(
  contractType: ContractType,
  symbolName: string,
  duration: number,
  unit: string,
  barrier?: string,
): string {
  const suffix =
    unit === "t" ? `${duration} ticks` : `${duration} ${unit === "s" ? "seconds" : unit === "m" ? "minutes" : unit === "h" ? "hours" : "days"}`;
  switch (contractType) {
    case "CALL":
      return `Rise if the exit spot is strictly higher than the entry spot after ${suffix} on ${symbolName}.`;
    case "PUT":
      return `Fall if the exit spot is strictly lower than the entry spot after ${suffix} on ${symbolName}.`;
    case "DIGITMATCH":
      return `Win if the last digit of the exit spot equals ${barrier ?? "0"} after ${suffix} on ${symbolName}.`;
    case "DIGITDIFF":
      return `Win if the last digit of the exit spot differs from ${barrier ?? "0"} after ${suffix} on ${symbolName}.`;
    case "DIGITEVEN":
      return `Win if the last digit of the exit spot is even after ${suffix} on ${symbolName}.`;
    case "DIGITODD":
      return `Win if the last digit of the exit spot is odd after ${suffix} on ${symbolName}.`;
    case "DIGITOVER":
      return `Win if the last digit of the exit spot is greater than ${barrier ?? "5"} after ${suffix} on ${symbolName}.`;
    case "DIGITUNDER":
      return `Win if the last digit of the exit spot is less than ${barrier ?? "5"} after ${suffix} on ${symbolName}.`;
    default:
      return `${contractType} on ${symbolName} for ${suffix}.`;
  }
}
