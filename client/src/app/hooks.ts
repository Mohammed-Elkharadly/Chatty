import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from 'react-redux';
import type { AppDispatch, RootState } from './store';

// useAppDispatch: A ready-to-use dispatch that already knows our store's types.
export const useAppDispatch = () => useDispatch<AppDispatch>();

// useAppSelector: A ready-to-use selector that autocompletes our state for us.
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
