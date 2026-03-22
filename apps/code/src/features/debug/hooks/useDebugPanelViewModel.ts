import { createDebugPanelViewModel } from "./debugPanelViewModel";
import type {
  DebugPanelShellViewModelProps,
  DebugPanelVariant,
  DebugPanelViewModel,
  DebugPanelViewModelParams,
} from "./debugPanelViewModelTypes";
import { useDebugPanelViewModelInputs } from "./useDebugPanelViewModelInputs";

export type {
  DebugPanelShellViewModelProps,
  DebugPanelViewModel,
  DebugPanelViewModelParams,
  DebugPanelVariant,
};

export function useDebugPanelViewModel(params: DebugPanelViewModelParams): DebugPanelViewModel {
  return createDebugPanelViewModel(useDebugPanelViewModelInputs(params));
}
