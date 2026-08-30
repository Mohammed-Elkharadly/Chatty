import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from 'react-redux';
import type { AppDispatch, RootState } from './store';

// Create a typed version of useDispatch
// This hook knows what actions are valid in our app
// Gives autocomplete and type checking for dispatch
export const useAppDispatch = () => useDispatch<AppDispatch>();

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
