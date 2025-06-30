
import { createStore } from 'framework7';

const store = createStore({
  state: {
    languages:[]
  },
  getters: {
    languages({ state }) {
      return state.languages;
    }
  },
  actions: {
    addProduct({ state }, product) {
      state.products = [...state.products, product];
    },
  },
})
export default store;
