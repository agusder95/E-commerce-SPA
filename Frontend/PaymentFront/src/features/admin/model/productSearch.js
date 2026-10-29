const searchKey = value => value.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

export const matchesProductName = (name, search) => searchKey(name).includes(searchKey(search));
