# watch-remotely

Watch file system changes through web socket connection

## Installation

    $ npm install -g watch-remotely

## Usage

Go to the directory you want to watch and run `watch-remotely` command:

    $ cd /path/to/the/directory/you/want/to/watch
    $ watch-remotely

Alternatively, you can pass the path directly:

    $ watch-remotely /path/to/the/directory/you/want/to/watch

To show the help message run:

    $ watch-remotely -h

## Running the tests

Just clone this repository, install its dependencies and run `npm test` command:

    $ git clone https://github.com/alexpods/watch-remotely
    $ cd watch-remotely
    $ npm install
    $ npm test

## License

The MIT License (MIT)
Copyright (c) 2015 Aleksey Podskrebyshev.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
