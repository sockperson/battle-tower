import { configureStore } from '@reduxjs/toolkit'
import battleReducer from './battleSlice'
import createWsMiddleware from './wsMiddleware'

const wsMiddleware = createWsMiddleware()

export const store = configureStore({
  reducer: { battle: battleReducer },
  middleware: (getDefault) => getDefault().concat(wsMiddleware),
})

export default store
