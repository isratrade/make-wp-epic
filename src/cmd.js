// @flow
import type {Options, Post, Category, Author} from './types';
import path from 'path';
import {all, map} from 'when';
import pipeline from 'when/pipeline';
import guard from 'when/guard';
import getOptions from './options';
import {setupFolders, writePost, writeCategory, writeAuthor} from './hugo';
import {connect,
  selectPosts, postWithMetadata,
  selectCategories, categoryWithMetdata,
  selectAuthors, authorWithMetadata
} from './db';
import {processPost, processCategory, processAuthor} from './processing';

let db;

getOptions()
  .then(connect)
  .then(setupFolders)
  .then(selectPosts)
  .then(selectCategories)
  .then(selectAuthors)
  .then(processItems('posts'))
  .then(processItems('categories'))
  .then(processItems('authors'))
  .then(() => {
    console.log('Done...');
    process.exit(0);
  })
  .catch(onError);


function onError(err) {
  console.error(err);
  process.exit(1);
}

type Collection = 'posts' | 'categories' | 'authors';
type Entry = Post | Category | Author;
type Processor = (Options, Object) => Object
type Procs = {posts: Array<Processor>, categories: Array<Processor>, authors: Array<Processor>};
function getPipeline(key: Collection, options) {
  const fns: Procs = {
    posts: [postWithMetadata, processPost, options.processors.post, writePost],
    categories: [categoryWithMetdata, processCategory, options.processors.category, writeCategory],
    authors: [authorWithMetadata, processAuthor, options.processors.author, writeAuthor]
  };

  return fns[key].map((fn) => fn.bind(fn, options));
}

function processItems(key: Collection) {
  return (options: Options) => {
    const pipe = (entry) => pipeline(getPipeline(key, options), entry);
    const guardedPipe = guard(guard.n(5), pipe);
    return all(map(options[key], guardedPipe)).then(() => options).catch(onError);
  };
}
