import fs from 'node:fs';
import os from 'node:os';
import v8 from 'node:v8';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
const { writeFile, readFile, readdir, mkdir, rm, stat, access, watch, lstat, cp, rename, link } = fsPromises;
const glob = fsPromises.glob || null;
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pipeline, finished } from 'node:stream/promises';
import { Readable, Writable, Transform, Duplex, addAbortSignal } from 'node:stream';
import { promisify, styleText, parseArgs, inspect, format } from 'node:util';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import * as readlinePromises from 'node:readline/promises';
import process, { stdin as input, stdout as output, stderr, env, exit, argv, cwd, pid } from 'node:process';
import { spawn, exec, execSync, fork, execFile } from 'node:child_process';
import { Worker, isMainThread, parentPort, MessageChannel, MessagePort } from 'node:worker_threads';
import { randomUUID, randomBytes, createHash, createHmac, scrypt, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import http2 from 'node:http2';
let DatabaseSync = null;
try {
  const sqliteModule = await import('node:sqlite');
  DatabaseSync = sqliteModule.DatabaseSync;
} catch (sqliteErr) {}
import { gzip, gunzip, deflate, inflate } from 'node:zlib';
import { test, describe, it, before, beforeEach, after, afterEach, mock } from 'node:test';
import assert from 'node:assert';

const createServer2 = http2.createSecureServer;
const createHttp2SecureServer = http2.createSecureServer;
const fetchApi = globalThis.fetch;
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const nodeApi = {
  fs,
  os,
  v8,
  readline,
  createRequire,
  process,
  Buffer,
  createReadStream,
  createWriteStream,
  writeFile,
  readFile,
  readdir,
  mkdir,
  rm,
  stat,
  access,
  watch,
  glob,
  lstat,
  cp,
  rename,
  link,
  path,
  fileURLToPath,
  pathToFileURL,
  pipeline,
  finished,
  addAbortSignal,
  Readable,
  Writable,
  Transform,
  Duplex,
  promisify,
  styleText,
  parseArgs,
  inspect,
  format,
  performance,
  PerformanceObserver,
  readlinePromises,
  input,
  output,
  stderr,
  env,
  exit,
  argv,
  cwd,
  pid,
  spawn,
  exec,
  execSync,
  fork,
  execFile,
  Worker,
  isMainThread,
  parentPort,
  MessageChannel,
  MessagePort,
  randomUUID,
  randomBytes,
  createHash,
  createHmac,
  scrypt,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  createServer,
  createHttpsServer,
  http2,
  DatabaseSync,
  gzip,
  gunzip,
  deflate,
  inflate,
  test,
  describe,
  it,
  before,
  beforeEach,
  after,
  afterEach,
  mock,
  assert,
  createServer2,
  createHttp2SecureServer,
  fetchApi,
  execAsync,
  execFileAsync,
  gzipAsync,
  gunzipAsync
};

const nodeImportsApi = nodeApi;

export default nodeApi;
export {
  nodeApi,
  nodeImportsApi,
  fs,
  os,
  v8,
  readline,
  createRequire,
  process,
  Buffer,
  createReadStream,
  createWriteStream,
  writeFile,
  readFile,
  readdir,
  mkdir,
  rm,
  stat,
  access,
  watch,
  glob,
  lstat,
  cp,
  rename,
  link,
  path,
  fileURLToPath,
  pathToFileURL,
  pipeline,
  finished,
  addAbortSignal,
  Readable,
  Writable,
  Transform,
  Duplex,
  promisify,
  styleText,
  parseArgs,
  inspect,
  format,
  performance,
  PerformanceObserver,
  readlinePromises,
  input,
  output,
  stderr,
  env,
  exit,
  argv,
  cwd,
  pid,
  spawn,
  exec,
  execSync,
  fork,
  execFile,
  Worker,
  isMainThread,
  parentPort,
  MessageChannel,
  MessagePort,
  randomUUID,
  randomBytes,
  createHash,
  createHmac,
  scrypt,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  createServer,
  createHttpsServer,
  http2,
  DatabaseSync,
  gzip,
  gunzip,
  deflate,
  inflate,
  test,
  describe,
  it,
  before,
  beforeEach,
  after,
  afterEach,
  mock,
  assert,
  createServer2,
  createHttp2SecureServer,
  fetchApi,
  execAsync,
  execFileAsync,
  gzipAsync,
  gunzipAsync
};
