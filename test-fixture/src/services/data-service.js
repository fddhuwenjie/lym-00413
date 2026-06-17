import { add } from '../utils/math.js';

export function fetchData() {
  return {
    items: [
      { id: 1, name: 'Item 1', value: add(10, 20) },
      { id: 2, name: 'Item 2', value: add(30, 40) },
      { id: 3, name: 'Item 3', value: add(50, 60) },
    ],
    total: 3,
    timestamp: Date.now(),
  };
}

export function transformData(data) {
  return data.items.map(item => ({
    ...item,
    computed: item.value * 2,
  }));
}

export function aggregateData(data) {
  return data.reduce((sum, item) => sum + item.value, 0);
}
