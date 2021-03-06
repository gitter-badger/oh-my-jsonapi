'use strict';

import * as _ from 'lodash';
import * as bs from 'bookshelf';
import * as knex from 'knex';

import * as Serializer from 'jsonapi-serializer';
import * as Mapper from '../src/mapper';

type Model = bs.Model<any>;
type Collection = bs.Collection<any>;

describe('Bookshelf Adapter', () => {
  let bookshelf: bs;
  let mapper: Mapper.Bookshelf;
  let domain: string = 'https://domain.com';

  beforeAll(() => {
    bookshelf = bs(knex((<knex.Config> {})));
    mapper = new Mapper.Bookshelf(domain);
  });

  afterAll((done: Function) => {
    bookshelf.knex.destroy(done);
  });

  it('should serialize a basic model', () => {
    let model: Model = bookshelf.Model.forge<any>({
      id: '5',
      name: 'A test model',
      description: 'something to use as a test'
    });

    let result: any = mapper.map(model, 'models');

    let expected: any = {
      data: {
        id: '5',
        type: 'models',
        attributes: {
          name: 'A test model',
          description: 'something to use as a test'
        }
      }
    };

    expect(_.matches(expected)(result)).toBe(true);
  });

  it('should not add the id to the attributes', () => {
    let model: Model = bookshelf.Model.forge<any>({id: '5'});
    let result: any = mapper.map(model, 'models');

    expect(_.has(result, 'data.attributes.id')).toBe(false);
  });

  it('should ignore any *_id attribute on the attributes', () => {
    let model: Model = bookshelf.Model.forge<any>({
      id: '4',
      attr: 'value',
      'related_id': 123,
      'another_id': '456'
    });

    let result: any = mapper.map(model, 'models');

    let expected: any = {
      data: {
        id: '4',
        type: 'models',
        attributes: {
          attr: 'value'
        }
      }
    };

    expect(_.matches(expected)(result)).toBe(true);
    expect(_.isEqual(result.data.attributes, expected.data.attributes)).toBe(true);
  });

  it('should ignore any *_type attribute on the attributes', () => {
    let model: Model = bookshelf.Model.forge<any>({
      id: '4',
      attr: 'value',
      'related_type': 'normal'
    });

    let result: any = mapper.map(model, 'models');

    let expected: any = {
      data: {
        id: '4',
        type: 'models',
        attributes: {
          attr: 'value'
        }
      }
    };

    expect(_.matches(expected)(result)).toBe(true);
    expect(_.isEqual(result.data.attributes, expected.data.attributes)).toBe(true);
  });

  it('should serialize a collection', () => {
    let elements: Model[] = _.range(5).map((num: number) => {
      return bookshelf.Model.forge<any>({id: num, attr: 'value' + num});
    });

    let collection: Collection = bookshelf.Collection.forge<any>(elements);

    let result: any = mapper.map(collection, 'models');

    let expected: any = {
      data: _.range(5).map((num: number) => {
        return {
          id: num.toString(),
          type: 'models',
          attributes: {
            attr: 'value' + num
          }
        };
      })
    };

    expect(_.matches(expected)(result)).toBe(true);
  });
});

describe('Bookshelf links', () => {
  let bookshelf: bs;
  let mapper: Mapper.Bookshelf;
  let domain: string = 'https://domain.com';

  beforeAll(() => {
    bookshelf = bs(knex((<knex.Config> {})));
    mapper = new Mapper.Bookshelf(domain);
  });

  afterAll((done: Function) => {
    bookshelf.knex.destroy(done);
  });

  it('should add top level links', () => {
    let model: Model = bookshelf.Model.forge<any>({id: '10'});

    let result: any = mapper.map(model, 'models');

    let expected: any = {
      data: {
        id: '10',
        type: 'models'
      },
      links: {
        self: domain + '/models'
      }
    };

    expect(_.matches(expected)(result)).toBe(true);
  });

  it('should add primary data links', () => {
    let model: Model = bookshelf.Model.forge<any>({id: '5'});

    let result: any = mapper.map(model, 'models');

    let expected: any = {
      data: {
        id: '5',
        type: 'models',
        links: {
          self: domain + '/models' + '/5'
        }
      }
    };

    expect(_.matches(expected)(result)).toBe(true);

  });

  it('should add related links', () => {
    let model: Model = bookshelf.Model.forge<any>({id: '5'});
    (<any> model).relations['related-model'] = bookshelf.Model.forge<any>({id: '10'});

    let result: any = mapper.map(model, 'models');

    let expected: any = {
      data: {
        relationships: {
          'related-model': {
            data: {
              id: '10',
              type: 'related-models' // TODO check correct casing
            },
            links: {
              self: domain + '/models/' + '5' + '/relationships/' + 'related-model',
              related: domain + '/models/' + '5' + '/related-model'
            }
          }
        }
      }
    };

    expect(_.matches(expected)(result)).toBe(true);

  });

  it('should add pagination links', () => {
    let limit: number = 10;
    let offset: number = 40;
    let total: number = 100;

    let elements: Model[] = _.range(10).map((num: number) => {
      return bookshelf.Model.forge<any>({id: num, attr: 'value' + num});
    });

    let collection: Collection = bookshelf.Collection.forge<any>(elements);

    let result: any = mapper.map(collection, 'models', {
      pagination: {
        limit: limit,
        offset: offset,
        total: total
      }
    });

    let expected: any = {
      links: {
        first: domain + '/models?page[limit]=' + limit + '&page[offset]=' + 0,
        prev: domain + '/models?page[limit]=' + limit + '&page[offset]=' + (offset - limit),
        next: domain + '/models?page[limit]=' + limit + '&page[offset]=' + (offset + limit),
        last: domain + '/models?page[limit]=' + limit + '&page[offset]=' + (total - limit)
      }
    };

    expect(_.matches(expected)(result)).toBe(true);
  });

});

describe('Bookshelf relations', () => {

  let bookshelf: bs;
  let mapper: Mapper.Bookshelf;
  let domain: string = 'https://domain.com';

  beforeAll(() => {
    bookshelf = bs(knex((<knex.Config> {})));
    mapper = new Mapper.Bookshelf(domain);
  });

  afterAll((done: Function) => {
    bookshelf.knex.destroy(done);
  });

  it('should add relationships object', () => {
    let model: Model = bookshelf.Model.forge<any>({id: '5', attr: 'value'});
    (<any> model).relations['related-model'] = bookshelf.Model.forge<any>({id: '10', attr2: 'value2'});

    let result: any = mapper.map(model, 'models');

    let expected: any = {
      data: {
        id: '5',
        type: 'models',
        attributes: {
          attr: 'value'
        },
        relationships: {
          'related-model': {
            data: {
              id: '10',
              type: 'related-models'
            }
          }
        }
      }
    };

    expect(_.matches(expected)(result)).toBe(true);

  });

  it('should put the single related object in the included array', () => {
    let model: Model = bookshelf.Model.forge<any>({id: '5', atrr: 'value'});
    (<any> model).relations['related-model'] = bookshelf.Model.forge<any>({id: '10', attr2: 'value2'});

    let result: any = mapper.map(model, 'models');

    let expected: any = {
      included: [
        {
          id: '10',
          type: 'related-models',
          attributes: {
            attr2: 'value2'
          }
        }
      ]
    };

    expect(_.matches(expected)(result)).toBe(true);
  });

  it('should put the array of related objects in the included array', () => {
    pending('Not targeted for release 1.x');
  });

  it('should give an API to ignore relations', () => {
    let model: Model = bookshelf.Model.forge<any>({id: '5', atrr: 'value'});
    (<any> model).relations['related-models'] = bookshelf.Collection.forge<any>([
      bookshelf.Model.forge<any>({id: '10', attr2: 'value20'}),
      bookshelf.Model.forge<any>({id: '11', attr2: 'value21'})
    ]);

    let result1: any = mapper.map(model, 'models', {relations: true});
    let result2: any = mapper.map(model, 'models', {relations: false});

    let expected1: any = {
      included: [
        {
          id: '10',
          type: 'related-models',
          attributes: {
            attr2: 'value20'
          }
        },
        {
          id: '11',
          type: 'related-models',
          attributes: {
            attr2: 'value21'
          }
        }
      ]
    };

    expect(_.matches(expected1)(result1)).toBe(true);
    expect(_.has(result2, 'data.relationships.related-models')).toBe(false);
    expect(_.has(result2, 'included')).toBe(false);

  });

  it('should give an API to merge relations attributes', () => {
    pending('Not targeted for release 1.x');
  });

});
