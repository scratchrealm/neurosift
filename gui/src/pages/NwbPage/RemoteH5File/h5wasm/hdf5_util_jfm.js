// jfm - import this from a separate file
import wasmBinaryFile from "./wasmBinaryFile.js";

var Module = (()=>{
    var _scriptDir = import.meta.url;

    return (function(Module) {
        Module = Module || {};

        var Module = typeof Module != "undefined" ? Module : {};
        var readyPromiseResolve, readyPromiseReject;
        Module["ready"] = new Promise(function(resolve, reject) {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject
        }
        );
        var moduleOverrides = Object.assign({}, Module);
        var arguments_ = [];
        var thisProgram = "./this.program";
        var quit_ = (status,toThrow)=>{
            throw toThrow
        }
        ;
        var ENVIRONMENT_IS_WEB = typeof window == "object";
        var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
        var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
        var scriptDirectory = "";
        function locateFile(path) {
            if (Module["locateFile"]) {
                return Module["locateFile"](path, scriptDirectory)
            }
            return scriptDirectory + path
        }
        var read_, readAsync, readBinary, setWindowTitle;
        if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
                scriptDirectory = self.location.href
            } else if (typeof document != "undefined" && document.currentScript) {
                scriptDirectory = document.currentScript.src
            }
            if (_scriptDir) {
                scriptDirectory = _scriptDir
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
                scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1)
            } else {
                scriptDirectory = ""
            }
            {
                read_ = url=>{
                    try {
                        var xhr = new XMLHttpRequest;
                        xhr.open("GET", url, false);
                        xhr.send(null);
                        return xhr.responseText
                    } catch (err) {
                        var data = tryParseAsDataURI(url);
                        if (data) {
                            return intArrayToString(data)
                        }
                        throw err
                    }
                }
                ;
                if (ENVIRONMENT_IS_WORKER) {
                    readBinary = url=>{
                        try {
                            var xhr = new XMLHttpRequest;
                            xhr.open("GET", url, false);
                            xhr.responseType = "arraybuffer";
                            xhr.send(null);
                            return new Uint8Array(xhr.response)
                        } catch (err) {
                            var data = tryParseAsDataURI(url);
                            if (data) {
                                return data
                            }
                            throw err
                        }
                    }
                }
                readAsync = (url,onload,onerror)=>{
                    var xhr = new XMLHttpRequest;
                    xhr.open("GET", url, true);
                    xhr.responseType = "arraybuffer";
                    xhr.onload = ()=>{
                        if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                            onload(xhr.response);
                            return
                        }
                        var data = tryParseAsDataURI(url);
                        if (data) {
                            onload(data.buffer);
                            return
                        }
                        onerror()
                    }
                    ;
                    xhr.onerror = onerror;
                    xhr.send(null)
                }
            }
            setWindowTitle = title=>document.title = title
        } else {}
        var out = Module["print"] || console.log.bind(console);
        var err = Module["printErr"] || console.warn.bind(console);
        Object.assign(Module, moduleOverrides);
        moduleOverrides = null;
        if (Module["arguments"])
            arguments_ = Module["arguments"];
        if (Module["thisProgram"])
            thisProgram = Module["thisProgram"];
        if (Module["quit"])
            quit_ = Module["quit"];
        var STACK_ALIGN = 16;
        var dynamicLibraries = Module["dynamicLibraries"] || [];
        var wasmBinary;
        if (Module["wasmBinary"])
            wasmBinary = Module["wasmBinary"];
        var noExitRuntime = Module["noExitRuntime"] || true;
        if (typeof WebAssembly != "object") {
            abort("no native wasm support detected")
        }
        var wasmMemory;
        var ABORT = false;
        var EXITSTATUS;
        function assert(condition, text) {
            if (!condition) {
                abort(text)
            }
        }
        var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : undefined;
        function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead) {
            var endIdx = idx + maxBytesToRead;
            var endPtr = idx;
            while (heapOrArray[endPtr] && !(endPtr >= endIdx))
                ++endPtr;
            if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
                return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr))
            }
            var str = "";
            while (idx < endPtr) {
                var u0 = heapOrArray[idx++];
                if (!(u0 & 128)) {
                    str += String.fromCharCode(u0);
                    continue
                }
                var u1 = heapOrArray[idx++] & 63;
                if ((u0 & 224) == 192) {
                    str += String.fromCharCode((u0 & 31) << 6 | u1);
                    continue
                }
                var u2 = heapOrArray[idx++] & 63;
                if ((u0 & 240) == 224) {
                    u0 = (u0 & 15) << 12 | u1 << 6 | u2
                } else {
                    u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63
                }
                if (u0 < 65536) {
                    str += String.fromCharCode(u0)
                } else {
                    var ch = u0 - 65536;
                    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
                }
            }
            return str
        }
        function UTF8ToString(ptr, maxBytesToRead) {
            return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
        }
        function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
            if (!(maxBytesToWrite > 0))
                return 0;
            var startIdx = outIdx;
            var endIdx = outIdx + maxBytesToWrite - 1;
            for (var i = 0; i < str.length; ++i) {
                var u = str.charCodeAt(i);
                if (u >= 55296 && u <= 57343) {
                    var u1 = str.charCodeAt(++i);
                    u = 65536 + ((u & 1023) << 10) | u1 & 1023
                }
                if (u <= 127) {
                    if (outIdx >= endIdx)
                        break;
                    heap[outIdx++] = u
                } else if (u <= 2047) {
                    if (outIdx + 1 >= endIdx)
                        break;
                    heap[outIdx++] = 192 | u >> 6;
                    heap[outIdx++] = 128 | u & 63
                } else if (u <= 65535) {
                    if (outIdx + 2 >= endIdx)
                        break;
                    heap[outIdx++] = 224 | u >> 12;
                    heap[outIdx++] = 128 | u >> 6 & 63;
                    heap[outIdx++] = 128 | u & 63
                } else {
                    if (outIdx + 3 >= endIdx)
                        break;
                    heap[outIdx++] = 240 | u >> 18;
                    heap[outIdx++] = 128 | u >> 12 & 63;
                    heap[outIdx++] = 128 | u >> 6 & 63;
                    heap[outIdx++] = 128 | u & 63
                }
            }
            heap[outIdx] = 0;
            return outIdx - startIdx
        }
        function stringToUTF8(str, outPtr, maxBytesToWrite) {
            return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
        }
        function lengthBytesUTF8(str) {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
                var c = str.charCodeAt(i);
                if (c <= 127) {
                    len++
                } else if (c <= 2047) {
                    len += 2
                } else if (c >= 55296 && c <= 57343) {
                    len += 4;
                    ++i
                } else {
                    len += 3
                }
            }
            return len
        }
        var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAP64, HEAPU64, HEAPF64;
        function updateGlobalBufferAndViews(buf) {
            buffer = buf;
            Module["HEAP8"] = HEAP8 = new Int8Array(buf);
            Module["HEAP16"] = HEAP16 = new Int16Array(buf);
            Module["HEAP32"] = HEAP32 = new Int32Array(buf);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
            Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
            Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
            Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
            Module["HEAP64"] = HEAP64 = new BigInt64Array(buf);
            Module["HEAPU64"] = HEAPU64 = new BigUint64Array(buf)
        }
        var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;
        if (Module["wasmMemory"]) {
            wasmMemory = Module["wasmMemory"]
        } else {
            wasmMemory = new WebAssembly.Memory({
                "initial": INITIAL_MEMORY / 65536,
                "maximum": 2147483648 / 65536
            })
        }
        if (wasmMemory) {
            buffer = wasmMemory.buffer
        }
        INITIAL_MEMORY = buffer.byteLength;
        updateGlobalBufferAndViews(buffer);
        var wasmTable = new WebAssembly.Table({
            "initial": 1720,
            "element": "anyfunc"
        });
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATMAIN__ = [];
        var __ATPOSTRUN__ = [];
        var __RELOC_FUNCS__ = [];
        var runtimeInitialized = false;
        function keepRuntimeAlive() {
            return noExitRuntime
        }
        function preRun() {
            if (Module["preRun"]) {
                if (typeof Module["preRun"] == "function")
                    Module["preRun"] = [Module["preRun"]];
                while (Module["preRun"].length) {
                    addOnPreRun(Module["preRun"].shift())
                }
            }
            callRuntimeCallbacks(__ATPRERUN__)
        }
        function initRuntime() {
            runtimeInitialized = true;
            callRuntimeCallbacks(__RELOC_FUNCS__);
            if (!Module["noFSInit"] && !FS.init.initialized)
                FS.init();
            FS.ignorePermissions = false;
            TTY.init();
            callRuntimeCallbacks(__ATINIT__)
        }
        function preMain() {
            callRuntimeCallbacks(__ATMAIN__)
        }
        function postRun() {
            if (Module["postRun"]) {
                if (typeof Module["postRun"] == "function")
                    Module["postRun"] = [Module["postRun"]];
                while (Module["postRun"].length) {
                    addOnPostRun(Module["postRun"].shift())
                }
            }
            callRuntimeCallbacks(__ATPOSTRUN__)
        }
        function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb)
        }
        function addOnInit(cb) {
            __ATINIT__.unshift(cb)
        }
        function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb)
        }
        var runDependencies = 0;
        var runDependencyWatcher = null;
        var dependenciesFulfilled = null;
        function getUniqueRunDependency(id) {
            return id
        }
        function addRunDependency(id) {
            runDependencies++;
            if (Module["monitorRunDependencies"]) {
                Module["monitorRunDependencies"](runDependencies)
            }
        }
        function removeRunDependency(id) {
            runDependencies--;
            if (Module["monitorRunDependencies"]) {
                Module["monitorRunDependencies"](runDependencies)
            }
            if (runDependencies == 0) {
                if (runDependencyWatcher !== null) {
                    clearInterval(runDependencyWatcher);
                    runDependencyWatcher = null
                }
                if (dependenciesFulfilled) {
                    var callback = dependenciesFulfilled;
                    dependenciesFulfilled = null;
                    callback()
                }
            }
        }
        function abort(what) {
            if (Module["onAbort"]) {
                Module["onAbort"](what)
            }
            what = "Aborted(" + what + ")";
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            what += ". Build with -sASSERTIONS for more info.";
            var e = new WebAssembly.RuntimeError(what);
            readyPromiseReject(e);
            throw e
        }
        var dataURIPrefix = "data:application/octet-stream;base64,";
        function isDataURI(filename) {
            return filename.startsWith(dataURIPrefix)
        }
        // jfm moved wasmBinaryFile to a separate file
        // var wasmBinaryFile;
        // wasmBinaryFile = ...;
        // if (!isDataURI(wasmBinaryFile)) {
        //     wasmBinaryFile = locateFile(wasmBinaryFile)
        // }
        function getBinary(file) {
            try {
                if (file == wasmBinaryFile && wasmBinary) {
                    return new Uint8Array(wasmBinary)
                }
                var binary = tryParseAsDataURI(file);
                if (binary) {
                    return binary
                }
                if (readBinary) {
                    return readBinary(file)
                }
                throw "both async and sync fetching of the wasm failed"
            } catch (err) {
                abort(err)
            }
        }
        function getBinaryPromise() {
            if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
                if (typeof fetch == "function") {
                    return fetch(wasmBinaryFile, {
                        credentials: "same-origin"
                    }).then(function(response) {
                        if (!response["ok"]) {
                            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
                        }
                        return response["arrayBuffer"]()
                    }).catch(function() {
                        return getBinary(wasmBinaryFile)
                    })
                }
            }
            return Promise.resolve().then(function() {
                return getBinary(wasmBinaryFile)
            })
        }
        function createWasm() {
            var info = {
                "env": asmLibraryArg,
                "wasi_snapshot_preview1": asmLibraryArg,
                "GOT.mem": new Proxy(asmLibraryArg,GOTHandler),
                "GOT.func": new Proxy(asmLibraryArg,GOTHandler)
            };
            function receiveInstance(instance, module) {
                var exports = instance.exports;
                exports = relocateExports(exports, 1024);
                var metadata = getDylinkMetadata(module);
                if (metadata.neededDynlibs) {
                    dynamicLibraries = metadata.neededDynlibs.concat(dynamicLibraries)
                }
                mergeLibSymbols(exports, "main");
                Module["asm"] = exports;
                addOnInit(Module["asm"]["__wasm_call_ctors"]);
                __RELOC_FUNCS__.push(Module["asm"]["__wasm_apply_data_relocs"]);
                removeRunDependency("wasm-instantiate")
            }
            addRunDependency("wasm-instantiate");
            function receiveInstantiationResult(result) {
                receiveInstance(result["instance"], result["module"])
            }
            function instantiateArrayBuffer(receiver) {
                return getBinaryPromise().then(function(binary) {
                    return WebAssembly.instantiate(binary, info)
                }).then(function(instance) {
                    return instance
                }).then(receiver, function(reason) {
                    err("failed to asynchronously prepare wasm: " + reason);
                    abort(reason)
                })
            }
            function instantiateAsync() {
                if (!wasmBinary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(wasmBinaryFile) && typeof fetch == "function") {
                    return fetch(wasmBinaryFile, {
                        credentials: "same-origin"
                    }).then(function(response) {
                        var result = WebAssembly.instantiateStreaming(response, info);
                        return result.then(receiveInstantiationResult, function(reason) {
                            err("wasm streaming compile failed: " + reason);
                            err("falling back to ArrayBuffer instantiation");
                            return instantiateArrayBuffer(receiveInstantiationResult)
                        })
                    })
                } else {
                    return instantiateArrayBuffer(receiveInstantiationResult)
                }
            }
            if (Module["instantiateWasm"]) {
                try {
                    var exports = Module["instantiateWasm"](info, receiveInstance);
                    return exports
                } catch (e) {
                    err("Module.instantiateWasm callback failed with error: " + e);
                    readyPromiseReject(e)
                }
            }
            instantiateAsync().catch(readyPromiseReject);
            return {}
        }
        var tempDouble;
        var tempI64;
        var ASM_CONSTS = {};
        function throw_error(string_error) {
            throw UTF8ToString(string_error)
        }
        function ExitStatus(status) {
            this.name = "ExitStatus";
            this.message = "Program terminated with exit(" + status + ")";
            this.status = status
        }
        var GOT = {};
        var CurrentModuleWeakSymbols = new Set([]);
        var GOTHandler = {
            get: function(obj, symName) {
                var rtn = GOT[symName];
                if (!rtn) {
                    rtn = GOT[symName] = new WebAssembly.Global({
                        "value": "i32",
                        "mutable": true
                    })
                }
                if (!CurrentModuleWeakSymbols.has(symName)) {
                    rtn.required = true
                }
                return rtn
            }
        };
        function callRuntimeCallbacks(callbacks) {
            while (callbacks.length > 0) {
                callbacks.shift()(Module)
            }
        }
        function getDylinkMetadata(binary) {
            var offset = 0;
            var end = 0;
            function getU8() {
                return binary[offset++]
            }
            function getLEB() {
                var ret = 0;
                var mul = 1;
                while (1) {
                    var byte = binary[offset++];
                    ret += (byte & 127) * mul;
                    mul *= 128;
                    if (!(byte & 128))
                        break
                }
                return ret
            }
            function getString() {
                var len = getLEB();
                offset += len;
                return UTF8ArrayToString(binary, offset - len, len)
            }
            function failIf(condition, message) {
                if (condition)
                    throw new Error(message)
            }
            var name = "dylink.0";
            if (binary instanceof WebAssembly.Module) {
                var dylinkSection = WebAssembly.Module.customSections(binary, name);
                if (dylinkSection.length === 0) {
                    name = "dylink";
                    dylinkSection = WebAssembly.Module.customSections(binary, name)
                }
                failIf(dylinkSection.length === 0, "need dylink section");
                binary = new Uint8Array(dylinkSection[0]);
                end = binary.length
            } else {
                var int32View = new Uint32Array(new Uint8Array(binary.subarray(0, 24)).buffer);
                var magicNumberFound = int32View[0] == 1836278016;
                failIf(!magicNumberFound, "need to see wasm magic number");
                failIf(binary[8] !== 0, "need the dylink section to be first");
                offset = 9;
                var section_size = getLEB();
                end = offset + section_size;
                name = getString()
            }
            var customSection = {
                neededDynlibs: [],
                tlsExports: new Set,
                weakImports: new Set
            };
            if (name == "dylink") {
                customSection.memorySize = getLEB();
                customSection.memoryAlign = getLEB();
                customSection.tableSize = getLEB();
                customSection.tableAlign = getLEB();
                var neededDynlibsCount = getLEB();
                for (var i = 0; i < neededDynlibsCount; ++i) {
                    var libname = getString();
                    customSection.neededDynlibs.push(libname)
                }
            } else {
                failIf(name !== "dylink.0");
                var WASM_DYLINK_MEM_INFO = 1;
                var WASM_DYLINK_NEEDED = 2;
                var WASM_DYLINK_EXPORT_INFO = 3;
                var WASM_DYLINK_IMPORT_INFO = 4;
                var WASM_SYMBOL_TLS = 256;
                var WASM_SYMBOL_BINDING_MASK = 3;
                var WASM_SYMBOL_BINDING_WEAK = 1;
                while (offset < end) {
                    var subsectionType = getU8();
                    var subsectionSize = getLEB();
                    if (subsectionType === WASM_DYLINK_MEM_INFO) {
                        customSection.memorySize = getLEB();
                        customSection.memoryAlign = getLEB();
                        customSection.tableSize = getLEB();
                        customSection.tableAlign = getLEB()
                    } else if (subsectionType === WASM_DYLINK_NEEDED) {
                        var neededDynlibsCount = getLEB();
                        for (var i = 0; i < neededDynlibsCount; ++i) {
                            libname = getString();
                            customSection.neededDynlibs.push(libname)
                        }
                    } else if (subsectionType === WASM_DYLINK_EXPORT_INFO) {
                        var count = getLEB();
                        while (count--) {
                            var symname = getString();
                            var flags = getLEB();
                            if (flags & WASM_SYMBOL_TLS) {
                                customSection.tlsExports.add(symname)
                            }
                        }
                    } else if (subsectionType === WASM_DYLINK_IMPORT_INFO) {
                        var count = getLEB();
                        while (count--) {
                            var modname = getString();
                            var symname = getString();
                            var flags = getLEB();
                            if ((flags & WASM_SYMBOL_BINDING_MASK) == WASM_SYMBOL_BINDING_WEAK) {
                                customSection.weakImports.add(symname)
                            }
                        }
                    } else {
                        offset += subsectionSize
                    }
                }
            }
            return customSection
        }
        function intArrayToString(array) {
            var ret = [];
            for (var i = 0; i < array.length; i++) {
                var chr = array[i];
                if (chr > 255) {
                    if (ASSERTIONS) {
                        assert(false, "Character code " + chr + " (" + String.fromCharCode(chr) + ")  at offset " + i + " not in 0x00-0xFF.")
                    }
                    chr &= 255
                }
                ret.push(String.fromCharCode(chr))
            }
            return ret.join("")
        }
        function asmjsMangle(x) {
            var unmangledSymbols = ["stackAlloc", "stackSave", "stackRestore", "getTempRet0", "setTempRet0"];
            return x.indexOf("dynCall_") == 0 || unmangledSymbols.includes(x) ? x : "_" + x
        }
        function mergeLibSymbols(exports, libName) {
            for (var sym in exports) {
                if (!exports.hasOwnProperty(sym)) {
                    continue
                }
                if (!asmLibraryArg.hasOwnProperty(sym)) {
                    asmLibraryArg[sym] = exports[sym]
                }
                var module_sym = asmjsMangle(sym);
                if (!Module.hasOwnProperty(module_sym)) {
                    Module[module_sym] = exports[sym]
                }
                if (sym == "__main_argc_argv") {
                    Module["_main"] = exports[sym]
                }
            }
        }
        var LDSO = {
            loadedLibsByName: {},
            loadedLibsByHandle: {}
        };
        var wasmTableMirror = [];
        function getWasmTableEntry(funcPtr) {
            var func = wasmTableMirror[funcPtr];
            if (!func) {
                if (funcPtr >= wasmTableMirror.length)
                    wasmTableMirror.length = funcPtr + 1;
                wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr)
            }
            return func
        }
        function dynCall(sig, ptr, args) {
            var rtn = getWasmTableEntry(ptr).apply(null, args);
            return rtn
        }
        function createInvokeFunction(sig) {
            return function() {
                var sp = stackSave();
                try {
                    return dynCall(sig, arguments[0], Array.prototype.slice.call(arguments, 1))
                } catch (e) {
                    stackRestore(sp);
                    if (e !== e + 0)
                        throw e;
                    _setThrew(1, 0)
                }
            }
        }
        var ___heap_base = 402240;
        function zeroMemory(address, size) {
            HEAPU8.fill(0, address, address + size);
            return address
        }
        function getMemory(size) {
            if (runtimeInitialized) {
                return zeroMemory(_malloc(size), size)
            }
            var ret = ___heap_base;
            var end = ret + size + 15 & -16;
            ___heap_base = end;
            GOT["__heap_base"].value = end;
            return ret
        }
        function isInternalSym(symName) {
            return ["__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm"].includes(symName)
        }
        function uleb128Encode(n, target) {
            if (n < 128) {
                target.push(n)
            } else {
                target.push(n % 128 | 128, n >> 7)
            }
        }
        function sigToWasmTypes(sig) {
            var typeNames = {
                "i": "i32",
                "j": "i32",
                "f": "f32",
                "d": "f64",
                "p": "i32"
            };
            var type = {
                parameters: [],
                results: sig[0] == "v" ? [] : [typeNames[sig[0]]]
            };
            for (var i = 1; i < sig.length; ++i) {
                type.parameters.push(typeNames[sig[i]]);
                if (sig[i] === "j") {
                    type.parameters.push("i32")
                }
            }
            return type
        }
        function generateFuncType(sig, target) {
            var sigRet = sig.slice(0, 1);
            var sigParam = sig.slice(1);
            var typeCodes = {
                "i": 127,
                "p": 127,
                "j": 126,
                "f": 125,
                "d": 124
            };
            target.push(96);
            uleb128Encode(sigParam.length, target);
            for (var i = 0; i < sigParam.length; ++i) {
                target.push(typeCodes[sigParam[i]])
            }
            if (sigRet == "v") {
                target.push(0)
            } else {
                target.push(1, typeCodes[sigRet])
            }
        }
        function convertJsFunctionToWasm(func, sig) {
            if (typeof WebAssembly.Function == "function") {
                return new WebAssembly.Function(sigToWasmTypes(sig),func)
            }
            var typeSectionBody = [1];
            generateFuncType(sig, typeSectionBody);
            var bytes = [0, 97, 115, 109, 1, 0, 0, 0, 1];
            uleb128Encode(typeSectionBody.length, bytes);
            bytes.push.apply(bytes, typeSectionBody);
            bytes.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
            var module = new WebAssembly.Module(new Uint8Array(bytes));
            var instance = new WebAssembly.Instance(module,{
                "e": {
                    "f": func
                }
            });
            var wrappedFunc = instance.exports["f"];
            return wrappedFunc
        }
        function updateTableMap(offset, count) {
            if (functionsInTableMap) {
                for (var i = offset; i < offset + count; i++) {
                    var item = getWasmTableEntry(i);
                    if (item) {
                        functionsInTableMap.set(item, i)
                    }
                }
            }
        }
        var functionsInTableMap = undefined;
        var freeTableIndexes = [];
        function getEmptyTableSlot() {
            if (freeTableIndexes.length) {
                return freeTableIndexes.pop()
            }
            try {
                wasmTable.grow(1)
            } catch (err) {
                if (!(err instanceof RangeError)) {
                    throw err
                }
                throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH."
            }
            return wasmTable.length - 1
        }
        function setWasmTableEntry(idx, func) {
            wasmTable.set(idx, func);
            wasmTableMirror[idx] = wasmTable.get(idx)
        }
        function addFunction(func, sig) {
            if (!functionsInTableMap) {
                functionsInTableMap = new WeakMap;
                updateTableMap(0, wasmTable.length)
            }
            if (functionsInTableMap.has(func)) {
                return functionsInTableMap.get(func)
            }
            var ret = getEmptyTableSlot();
            try {
                setWasmTableEntry(ret, func)
            } catch (err) {
                if (!(err instanceof TypeError)) {
                    throw err
                }
                var wrapped = convertJsFunctionToWasm(func, sig);
                setWasmTableEntry(ret, wrapped)
            }
            functionsInTableMap.set(func, ret);
            return ret
        }
        function updateGOT(exports, replace) {
            for (var symName in exports) {
                if (isInternalSym(symName)) {
                    continue
                }
                var value = exports[symName];
                if (!GOT[symName]) {
                    GOT[symName] = new WebAssembly.Global({
                        "value": "i32",
                        "mutable": true
                    })
                }
                if (replace || GOT[symName].value == 0) {
                    if (typeof value == "function") {
                        GOT[symName].value = addFunction(value)
                    } else if (typeof value == "number") {
                        GOT[symName].value = value
                    } else {
                        err("unhandled export type for `" + symName + "`: " + typeof value)
                    }
                }
            }
        }
        function relocateExports(exports, memoryBase, replace) {
            var relocated = {};
            for (var e in exports) {
                var value = exports[e];
                if (typeof value == "object") {
                    value = value.value
                }
                if (typeof value == "number") {
                    value += memoryBase
                }
                relocated[e] = value
            }
            updateGOT(relocated, replace);
            return relocated
        }
        function resolveGlobalSymbol(symName, direct) {
            var sym;
            if (!sym) {
                sym = asmLibraryArg[symName];
                if (sym && sym.stub)
                    sym = undefined
            }
            if (!sym) {
                sym = Module[asmjsMangle(symName)]
            }
            if (!sym && symName.startsWith("invoke_")) {
                sym = createInvokeFunction(symName.split("_")[1])
            }
            return sym
        }
        function alignMemory(size, alignment) {
            return Math.ceil(size / alignment) * alignment
        }
        function loadWebAssemblyModule(binary, flags, handle) {
            var metadata = getDylinkMetadata(binary);
            CurrentModuleWeakSymbols = metadata.weakImports;
            function loadModule() {
                var firstLoad = !handle || !HEAP8[handle + 24 >> 0];
                if (firstLoad) {
                    var memAlign = Math.pow(2, metadata.memoryAlign);
                    memAlign = Math.max(memAlign, STACK_ALIGN);
                    var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0;
                    var tableBase = metadata.tableSize ? wasmTable.length : 0;
                    if (handle) {
                        HEAP8[handle + 24 >> 0] = 1;
                        HEAPU32[handle + 28 >> 2] = memoryBase;
                        HEAP32[handle + 32 >> 2] = metadata.memorySize;
                        HEAPU32[handle + 36 >> 2] = tableBase;
                        HEAP32[handle + 40 >> 2] = metadata.tableSize
                    }
                } else {
                    memoryBase = HEAPU32[handle + 28 >> 2];
                    tableBase = HEAPU32[handle + 36 >> 2]
                }
                var tableGrowthNeeded = tableBase + metadata.tableSize - wasmTable.length;
                if (tableGrowthNeeded > 0) {
                    wasmTable.grow(tableGrowthNeeded)
                }
                var moduleExports;
                function resolveSymbol(sym) {
                    var resolved = resolveGlobalSymbol(sym, false);
                    if (!resolved) {
                        resolved = moduleExports[sym]
                    }
                    return resolved
                }
                var proxyHandler = {
                    "get": function(stubs, prop) {
                        switch (prop) {
                        case "__memory_base":
                            return memoryBase;
                        case "__table_base":
                            return tableBase
                        }
                        if (prop in asmLibraryArg) {
                            return asmLibraryArg[prop]
                        }
                        if (!(prop in stubs)) {
                            var resolved;
                            stubs[prop] = function() {
                                if (!resolved)
                                    resolved = resolveSymbol(prop);
                                return resolved.apply(null, arguments)
                            }
                        }
                        return stubs[prop]
                    }
                };
                var proxy = new Proxy({},proxyHandler);
                var info = {
                    "GOT.mem": new Proxy({},GOTHandler),
                    "GOT.func": new Proxy({},GOTHandler),
                    "env": proxy,
                    wasi_snapshot_preview1: proxy
                };
                function postInstantiation(instance) {
                    updateTableMap(tableBase, metadata.tableSize);
                    moduleExports = relocateExports(instance.exports, memoryBase);
                    if (!flags.allowUndefined) {
                        reportUndefinedSymbols()
                    }
                    function addEmAsm(addr, body) {
                        var args = [];
                        var arity = 0;
                        for (; arity < 16; arity++) {
                            if (body.indexOf("$" + arity) != -1) {
                                args.push("$" + arity)
                            } else {
                                break
                            }
                        }
                        args = args.join(",");
                        var func = "(" + args + " ) => { " + body + "};";
                        ASM_CONSTS[start] = eval(func)
                    }
                    if ("__start_em_asm"in moduleExports) {
                        var start = moduleExports["__start_em_asm"];
                        var stop = moduleExports["__stop_em_asm"];
                        while (start < stop) {
                            var jsString = UTF8ToString(start);
                            addEmAsm(start, jsString);
                            start = HEAPU8.indexOf(0, start) + 1
                        }
                    }
                    var applyRelocs = moduleExports["__wasm_apply_data_relocs"];
                    if (applyRelocs) {
                        if (runtimeInitialized) {
                            applyRelocs()
                        } else {
                            __RELOC_FUNCS__.push(applyRelocs)
                        }
                    }
                    var init = moduleExports["__wasm_call_ctors"];
                    if (init) {
                        if (runtimeInitialized) {
                            init()
                        } else {
                            __ATINIT__.push(init)
                        }
                    }
                    return moduleExports
                }
                if (flags.loadAsync) {
                    if (binary instanceof WebAssembly.Module) {
                        var instance = new WebAssembly.Instance(binary,info);
                        return Promise.resolve(postInstantiation(instance))
                    }
                    return WebAssembly.instantiate(binary, info).then(function(result) {
                        return postInstantiation(result.instance)
                    })
                }
                var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
                var instance = new WebAssembly.Instance(module,info);
                return postInstantiation(instance)
            }
            if (flags.loadAsync) {
                return metadata.neededDynlibs.reduce(function(chain, dynNeeded) {
                    return chain.then(function() {
                        return loadDynamicLibrary(dynNeeded, flags)
                    })
                }, Promise.resolve()).then(function() {
                    return loadModule()
                })
            }
            metadata.neededDynlibs.forEach(function(dynNeeded) {
                loadDynamicLibrary(dynNeeded, flags)
            });
            return loadModule()
        }
        function loadDynamicLibrary(lib, flags, handle) {
            flags = flags || {
                global: true,
                nodelete: true
            };
            var dso = LDSO.loadedLibsByName[lib];
            if (dso) {
                if (flags.global && !dso.global) {
                    dso.global = true;
                    if (dso.module !== "loading") {
                        mergeLibSymbols(dso.module, lib)
                    }
                }
                if (flags.nodelete && dso.refcount !== Infinity) {
                    dso.refcount = Infinity
                }
                dso.refcount++;
                if (handle) {
                    LDSO.loadedLibsByHandle[handle] = dso
                }
                return flags.loadAsync ? Promise.resolve(true) : true
            }
            dso = {
                refcount: flags.nodelete ? Infinity : 1,
                name: lib,
                module: "loading",
                global: flags.global
            };
            LDSO.loadedLibsByName[lib] = dso;
            if (handle) {
                LDSO.loadedLibsByHandle[handle] = dso
            }
            function loadLibData(libFile) {
                if (flags.fs && flags.fs.findObject(libFile)) {
                    var libData = flags.fs.readFile(libFile, {
                        encoding: "binary"
                    });
                    if (!(libData instanceof Uint8Array)) {
                        libData = new Uint8Array(libData)
                    }
                    return flags.loadAsync ? Promise.resolve(libData) : libData
                }
                if (flags.loadAsync) {
                    return new Promise(function(resolve, reject) {
                        readAsync(libFile, data=>resolve(new Uint8Array(data)), reject)
                    }
                    )
                }
                if (!readBinary) {
                    throw new Error(libFile + ": file not found, and synchronous loading of external files is not available")
                }
                return readBinary(libFile)
            }
            function getLibModule() {
                if (typeof preloadedWasm != "undefined" && preloadedWasm[lib]) {
                    var libModule = preloadedWasm[lib];
                    return flags.loadAsync ? Promise.resolve(libModule) : libModule
                }
                if (flags.loadAsync) {
                    return loadLibData(lib).then(function(libData) {
                        return loadWebAssemblyModule(libData, flags, handle)
                    })
                }
                return loadWebAssemblyModule(loadLibData(lib), flags, handle)
            }
            function moduleLoaded(libModule) {
                if (dso.global) {
                    mergeLibSymbols(libModule, lib)
                }
                dso.module = libModule
            }
            if (flags.loadAsync) {
                return getLibModule().then(function(libModule) {
                    moduleLoaded(libModule);
                    return true
                })
            }
            moduleLoaded(getLibModule());
            return true
        }
        function reportUndefinedSymbols() {
            for (var symName in GOT) {
                if (GOT[symName].value == 0) {
                    var value = resolveGlobalSymbol(symName, true);
                    if (!value && !GOT[symName].required) {
                        continue
                    }
                    if (typeof value == "function") {
                        GOT[symName].value = addFunction(value, value.sig)
                    } else if (typeof value == "number") {
                        GOT[symName].value = value
                    } else {
                        throw new Error("bad export type for `" + symName + "`: " + typeof value)
                    }
                }
            }
        }
        function preloadDylibs() {
            if (!dynamicLibraries.length) {
                reportUndefinedSymbols();
                return
            }
            addRunDependency("preloadDylibs");
            dynamicLibraries.reduce(function(chain, lib) {
                return chain.then(function() {
                    return loadDynamicLibrary(lib, {
                        loadAsync: true,
                        global: true,
                        nodelete: true,
                        allowUndefined: true
                    })
                })
            }, Promise.resolve()).then(function() {
                reportUndefinedSymbols();
                removeRunDependency("preloadDylibs")
            })
        }
        function ___assert_fail(condition, filename, line, func) {
            abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"])
        }
        ___assert_fail.sig = "vppip";
        function ExceptionInfo(excPtr) {
            this.excPtr = excPtr;
            this.ptr = excPtr - 24;
            this.set_type = function(type) {
                HEAPU32[this.ptr + 4 >> 2] = type
            }
            ;
            this.get_type = function() {
                return HEAPU32[this.ptr + 4 >> 2]
            }
            ;
            this.set_destructor = function(destructor) {
                HEAPU32[this.ptr + 8 >> 2] = destructor
            }
            ;
            this.get_destructor = function() {
                return HEAPU32[this.ptr + 8 >> 2]
            }
            ;
            this.set_refcount = function(refcount) {
                HEAP32[this.ptr >> 2] = refcount
            }
            ;
            this.set_caught = function(caught) {
                caught = caught ? 1 : 0;
                HEAP8[this.ptr + 12 >> 0] = caught
            }
            ;
            this.get_caught = function() {
                return HEAP8[this.ptr + 12 >> 0] != 0
            }
            ;
            this.set_rethrown = function(rethrown) {
                rethrown = rethrown ? 1 : 0;
                HEAP8[this.ptr + 13 >> 0] = rethrown
            }
            ;
            this.get_rethrown = function() {
                return HEAP8[this.ptr + 13 >> 0] != 0
            }
            ;
            this.init = function(type, destructor) {
                this.set_adjusted_ptr(0);
                this.set_type(type);
                this.set_destructor(destructor);
                this.set_refcount(0);
                this.set_caught(false);
                this.set_rethrown(false)
            }
            ;
            this.add_ref = function() {
                var value = HEAP32[this.ptr >> 2];
                HEAP32[this.ptr >> 2] = value + 1
            }
            ;
            this.release_ref = function() {
                var prev = HEAP32[this.ptr >> 2];
                HEAP32[this.ptr >> 2] = prev - 1;
                return prev === 1
            }
            ;
            this.set_adjusted_ptr = function(adjustedPtr) {
                HEAPU32[this.ptr + 16 >> 2] = adjustedPtr
            }
            ;
            this.get_adjusted_ptr = function() {
                return HEAPU32[this.ptr + 16 >> 2]
            }
            ;
            this.get_exception_ptr = function() {
                var isPointer = Module["___cxa_is_pointer_type"](this.get_type());
                if (isPointer) {
                    return HEAPU32[this.excPtr >> 2]
                }
                var adjusted = this.get_adjusted_ptr();
                if (adjusted !== 0)
                    return adjusted;
                return this.excPtr
            }
        }
        var exceptionLast = 0;
        var uncaughtExceptionCount = 0;
        function ___cxa_throw(ptr, type, destructor) {
            var info = new ExceptionInfo(ptr);
            info.init(type, destructor);
            exceptionLast = ptr;
            uncaughtExceptionCount++;
            throw ptr
        }
        ___cxa_throw.sig = "vppp";
        var ___memory_base = new WebAssembly.Global({
            "value": "i32",
            "mutable": false
        },1024);
        var ___stack_pointer = new WebAssembly.Global({
            "value": "i32",
            "mutable": true
        },402240);
        var PATH = {
            isAbs: path=>path.charAt(0) === "/",
            splitPath: filename=>{
                var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
                return splitPathRe.exec(filename).slice(1)
            }
            ,
            normalizeArray: (parts,allowAboveRoot)=>{
                var up = 0;
                for (var i = parts.length - 1; i >= 0; i--) {
                    var last = parts[i];
                    if (last === ".") {
                        parts.splice(i, 1)
                    } else if (last === "..") {
                        parts.splice(i, 1);
                        up++
                    } else if (up) {
                        parts.splice(i, 1);
                        up--
                    }
                }
                if (allowAboveRoot) {
                    for (; up; up--) {
                        parts.unshift("..")
                    }
                }
                return parts
            }
            ,
            normalize: path=>{
                var isAbsolute = PATH.isAbs(path)
                  , trailingSlash = path.substr(-1) === "/";
                path = PATH.normalizeArray(path.split("/").filter(p=>!!p), !isAbsolute).join("/");
                if (!path && !isAbsolute) {
                    path = "."
                }
                if (path && trailingSlash) {
                    path += "/"
                }
                return (isAbsolute ? "/" : "") + path
            }
            ,
            dirname: path=>{
                var result = PATH.splitPath(path)
                  , root = result[0]
                  , dir = result[1];
                if (!root && !dir) {
                    return "."
                }
                if (dir) {
                    dir = dir.substr(0, dir.length - 1)
                }
                return root + dir
            }
            ,
            basename: path=>{
                if (path === "/")
                    return "/";
                path = PATH.normalize(path);
                path = path.replace(/\/$/, "");
                var lastSlash = path.lastIndexOf("/");
                if (lastSlash === -1)
                    return path;
                return path.substr(lastSlash + 1)
            }
            ,
            join: function() {
                var paths = Array.prototype.slice.call(arguments);
                return PATH.normalize(paths.join("/"))
            },
            join2: (l,r)=>{
                return PATH.normalize(l + "/" + r)
            }
        };
        function getRandomDevice() {
            if (typeof crypto == "object" && typeof crypto["getRandomValues"] == "function") {
                var randomBuffer = new Uint8Array(1);
                return ()=>{
                    crypto.getRandomValues(randomBuffer);
                    return randomBuffer[0]
                }
            } else
                return ()=>abort("randomDevice")
        }
        var PATH_FS = {
            resolve: function() {
                var resolvedPath = ""
                  , resolvedAbsolute = false;
                for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
                    var path = i >= 0 ? arguments[i] : FS.cwd();
                    if (typeof path != "string") {
                        throw new TypeError("Arguments to path.resolve must be strings")
                    } else if (!path) {
                        return ""
                    }
                    resolvedPath = path + "/" + resolvedPath;
                    resolvedAbsolute = PATH.isAbs(path)
                }
                resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p=>!!p), !resolvedAbsolute).join("/");
                return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
            },
            relative: (from,to)=>{
                from = PATH_FS.resolve(from).substr(1);
                to = PATH_FS.resolve(to).substr(1);
                function trim(arr) {
                    var start = 0;
                    for (; start < arr.length; start++) {
                        if (arr[start] !== "")
                            break
                    }
                    var end = arr.length - 1;
                    for (; end >= 0; end--) {
                        if (arr[end] !== "")
                            break
                    }
                    if (start > end)
                        return [];
                    return arr.slice(start, end - start + 1)
                }
                var fromParts = trim(from.split("/"));
                var toParts = trim(to.split("/"));
                var length = Math.min(fromParts.length, toParts.length);
                var samePartsLength = length;
                for (var i = 0; i < length; i++) {
                    if (fromParts[i] !== toParts[i]) {
                        samePartsLength = i;
                        break
                    }
                }
                var outputParts = [];
                for (var i = samePartsLength; i < fromParts.length; i++) {
                    outputParts.push("..")
                }
                outputParts = outputParts.concat(toParts.slice(samePartsLength));
                return outputParts.join("/")
            }
        };
        function intArrayFromString(stringy, dontAddNull, length) {
            var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
            var u8array = new Array(len);
            var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
            if (dontAddNull)
                u8array.length = numBytesWritten;
            return u8array
        }
        var TTY = {
            ttys: [],
            init: function() {},
            shutdown: function() {},
            register: function(dev, ops) {
                TTY.ttys[dev] = {
                    input: [],
                    output: [],
                    ops: ops
                };
                FS.registerDevice(dev, TTY.stream_ops)
            },
            stream_ops: {
                open: function(stream) {
                    var tty = TTY.ttys[stream.node.rdev];
                    if (!tty) {
                        throw new FS.ErrnoError(43)
                    }
                    stream.tty = tty;
                    stream.seekable = false
                },
                close: function(stream) {
                    stream.tty.ops.fsync(stream.tty)
                },
                fsync: function(stream) {
                    stream.tty.ops.fsync(stream.tty)
                },
                read: function(stream, buffer, offset, length, pos) {
                    if (!stream.tty || !stream.tty.ops.get_char) {
                        throw new FS.ErrnoError(60)
                    }
                    var bytesRead = 0;
                    for (var i = 0; i < length; i++) {
                        var result;
                        try {
                            result = stream.tty.ops.get_char(stream.tty)
                        } catch (e) {
                            throw new FS.ErrnoError(29)
                        }
                        if (result === undefined && bytesRead === 0) {
                            throw new FS.ErrnoError(6)
                        }
                        if (result === null || result === undefined)
                            break;
                        bytesRead++;
                        buffer[offset + i] = result
                    }
                    if (bytesRead) {
                        stream.node.timestamp = Date.now()
                    }
                    return bytesRead
                },
                write: function(stream, buffer, offset, length, pos) {
                    if (!stream.tty || !stream.tty.ops.put_char) {
                        throw new FS.ErrnoError(60)
                    }
                    try {
                        for (var i = 0; i < length; i++) {
                            stream.tty.ops.put_char(stream.tty, buffer[offset + i])
                        }
                    } catch (e) {
                        throw new FS.ErrnoError(29)
                    }
                    if (length) {
                        stream.node.timestamp = Date.now()
                    }
                    return i
                }
            },
            default_tty_ops: {
                get_char: function(tty) {
                    if (!tty.input.length) {
                        var result = null;
                        if (typeof window != "undefined" && typeof window.prompt == "function") {
                            result = window.prompt("Input: ");
                            if (result !== null) {
                                result += "\n"
                            }
                        } else if (typeof readline == "function") {
                            result = readline();
                            if (result !== null) {
                                result += "\n"
                            }
                        }
                        if (!result) {
                            return null
                        }
                        tty.input = intArrayFromString(result, true)
                    }
                    return tty.input.shift()
                },
                put_char: function(tty, val) {
                    if (val === null || val === 10) {
                        out(UTF8ArrayToString(tty.output, 0));
                        tty.output = []
                    } else {
                        if (val != 0)
                            tty.output.push(val)
                    }
                },
                fsync: function(tty) {
                    if (tty.output && tty.output.length > 0) {
                        out(UTF8ArrayToString(tty.output, 0));
                        tty.output = []
                    }
                }
            },
            default_tty1_ops: {
                put_char: function(tty, val) {
                    if (val === null || val === 10) {
                        err(UTF8ArrayToString(tty.output, 0));
                        tty.output = []
                    } else {
                        if (val != 0)
                            tty.output.push(val)
                    }
                },
                fsync: function(tty) {
                    if (tty.output && tty.output.length > 0) {
                        err(UTF8ArrayToString(tty.output, 0));
                        tty.output = []
                    }
                }
            }
        };
        function mmapAlloc(size) {
            abort()
        }
        var MEMFS = {
            ops_table: null,
            mount: function(mount) {
                return MEMFS.createNode(null, "/", 16384 | 511, 0)
            },
            createNode: function(parent, name, mode, dev) {
                if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
                    throw new FS.ErrnoError(63)
                }
                if (!MEMFS.ops_table) {
                    MEMFS.ops_table = {
                        dir: {
                            node: {
                                getattr: MEMFS.node_ops.getattr,
                                setattr: MEMFS.node_ops.setattr,
                                lookup: MEMFS.node_ops.lookup,
                                mknod: MEMFS.node_ops.mknod,
                                rename: MEMFS.node_ops.rename,
                                unlink: MEMFS.node_ops.unlink,
                                rmdir: MEMFS.node_ops.rmdir,
                                readdir: MEMFS.node_ops.readdir,
                                symlink: MEMFS.node_ops.symlink
                            },
                            stream: {
                                llseek: MEMFS.stream_ops.llseek
                            }
                        },
                        file: {
                            node: {
                                getattr: MEMFS.node_ops.getattr,
                                setattr: MEMFS.node_ops.setattr
                            },
                            stream: {
                                llseek: MEMFS.stream_ops.llseek,
                                read: MEMFS.stream_ops.read,
                                write: MEMFS.stream_ops.write,
                                allocate: MEMFS.stream_ops.allocate,
                                mmap: MEMFS.stream_ops.mmap,
                                msync: MEMFS.stream_ops.msync
                            }
                        },
                        link: {
                            node: {
                                getattr: MEMFS.node_ops.getattr,
                                setattr: MEMFS.node_ops.setattr,
                                readlink: MEMFS.node_ops.readlink
                            },
                            stream: {}
                        },
                        chrdev: {
                            node: {
                                getattr: MEMFS.node_ops.getattr,
                                setattr: MEMFS.node_ops.setattr
                            },
                            stream: FS.chrdev_stream_ops
                        }
                    }
                }
                var node = FS.createNode(parent, name, mode, dev);
                if (FS.isDir(node.mode)) {
                    node.node_ops = MEMFS.ops_table.dir.node;
                    node.stream_ops = MEMFS.ops_table.dir.stream;
                    node.contents = {}
                } else if (FS.isFile(node.mode)) {
                    node.node_ops = MEMFS.ops_table.file.node;
                    node.stream_ops = MEMFS.ops_table.file.stream;
                    node.usedBytes = 0;
                    node.contents = null
                } else if (FS.isLink(node.mode)) {
                    node.node_ops = MEMFS.ops_table.link.node;
                    node.stream_ops = MEMFS.ops_table.link.stream
                } else if (FS.isChrdev(node.mode)) {
                    node.node_ops = MEMFS.ops_table.chrdev.node;
                    node.stream_ops = MEMFS.ops_table.chrdev.stream
                }
                node.timestamp = Date.now();
                if (parent) {
                    parent.contents[name] = node;
                    parent.timestamp = node.timestamp
                }
                return node
            },
            getFileDataAsTypedArray: function(node) {
                if (!node.contents)
                    return new Uint8Array(0);
                if (node.contents.subarray)
                    return node.contents.subarray(0, node.usedBytes);
                return new Uint8Array(node.contents)
            },
            expandFileStorage: function(node, newCapacity) {
                var prevCapacity = node.contents ? node.contents.length : 0;
                if (prevCapacity >= newCapacity)
                    return;
                var CAPACITY_DOUBLING_MAX = 1024 * 1024;
                newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
                if (prevCapacity != 0)
                    newCapacity = Math.max(newCapacity, 256);
                var oldContents = node.contents;
                node.contents = new Uint8Array(newCapacity);
                if (node.usedBytes > 0)
                    node.contents.set(oldContents.subarray(0, node.usedBytes), 0)
            },
            resizeFileStorage: function(node, newSize) {
                if (node.usedBytes == newSize)
                    return;
                if (newSize == 0) {
                    node.contents = null;
                    node.usedBytes = 0
                } else {
                    var oldContents = node.contents;
                    node.contents = new Uint8Array(newSize);
                    if (oldContents) {
                        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
                    }
                    node.usedBytes = newSize
                }
            },
            node_ops: {
                getattr: function(node) {
                    var attr = {};
                    attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
                    attr.ino = node.id;
                    attr.mode = node.mode;
                    attr.nlink = 1;
                    attr.uid = 0;
                    attr.gid = 0;
                    attr.rdev = node.rdev;
                    if (FS.isDir(node.mode)) {
                        attr.size = 4096
                    } else if (FS.isFile(node.mode)) {
                        attr.size = node.usedBytes
                    } else if (FS.isLink(node.mode)) {
                        attr.size = node.link.length
                    } else {
                        attr.size = 0
                    }
                    attr.atime = new Date(node.timestamp);
                    attr.mtime = new Date(node.timestamp);
                    attr.ctime = new Date(node.timestamp);
                    attr.blksize = 4096;
                    attr.blocks = Math.ceil(attr.size / attr.blksize);
                    return attr
                },
                setattr: function(node, attr) {
                    if (attr.mode !== undefined) {
                        node.mode = attr.mode
                    }
                    if (attr.timestamp !== undefined) {
                        node.timestamp = attr.timestamp
                    }
                    if (attr.size !== undefined) {
                        MEMFS.resizeFileStorage(node, attr.size)
                    }
                },
                lookup: function(parent, name) {
                    throw FS.genericErrors[44]
                },
                mknod: function(parent, name, mode, dev) {
                    return MEMFS.createNode(parent, name, mode, dev)
                },
                rename: function(old_node, new_dir, new_name) {
                    if (FS.isDir(old_node.mode)) {
                        var new_node;
                        try {
                            new_node = FS.lookupNode(new_dir, new_name)
                        } catch (e) {}
                        if (new_node) {
                            for (var i in new_node.contents) {
                                throw new FS.ErrnoError(55)
                            }
                        }
                    }
                    delete old_node.parent.contents[old_node.name];
                    old_node.parent.timestamp = Date.now();
                    old_node.name = new_name;
                    new_dir.contents[new_name] = old_node;
                    new_dir.timestamp = old_node.parent.timestamp;
                    old_node.parent = new_dir
                },
                unlink: function(parent, name) {
                    delete parent.contents[name];
                    parent.timestamp = Date.now()
                },
                rmdir: function(parent, name) {
                    var node = FS.lookupNode(parent, name);
                    for (var i in node.contents) {
                        throw new FS.ErrnoError(55)
                    }
                    delete parent.contents[name];
                    parent.timestamp = Date.now()
                },
                readdir: function(node) {
                    var entries = [".", ".."];
                    for (var key in node.contents) {
                        if (!node.contents.hasOwnProperty(key)) {
                            continue
                        }
                        entries.push(key)
                    }
                    return entries
                },
                symlink: function(parent, newname, oldpath) {
                    var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
                    node.link = oldpath;
                    return node
                },
                readlink: function(node) {
                    if (!FS.isLink(node.mode)) {
                        throw new FS.ErrnoError(28)
                    }
                    return node.link
                }
            },
            stream_ops: {
                read: function(stream, buffer, offset, length, position) {
                    var contents = stream.node.contents;
                    if (position >= stream.node.usedBytes)
                        return 0;
                    var size = Math.min(stream.node.usedBytes - position, length);
                    if (size > 8 && contents.subarray) {
                        buffer.set(contents.subarray(position, position + size), offset)
                    } else {
                        for (var i = 0; i < size; i++)
                            buffer[offset + i] = contents[position + i]
                    }
                    return size
                },
                write: function(stream, buffer, offset, length, position, canOwn) {
                    if (buffer.buffer === HEAP8.buffer) {
                        canOwn = false
                    }
                    if (!length)
                        return 0;
                    var node = stream.node;
                    node.timestamp = Date.now();
                    if (buffer.subarray && (!node.contents || node.contents.subarray)) {
                        if (canOwn) {
                            node.contents = buffer.subarray(offset, offset + length);
                            node.usedBytes = length;
                            return length
                        } else if (node.usedBytes === 0 && position === 0) {
                            node.contents = buffer.slice(offset, offset + length);
                            node.usedBytes = length;
                            return length
                        } else if (position + length <= node.usedBytes) {
                            node.contents.set(buffer.subarray(offset, offset + length), position);
                            return length
                        }
                    }
                    MEMFS.expandFileStorage(node, position + length);
                    if (node.contents.subarray && buffer.subarray) {
                        node.contents.set(buffer.subarray(offset, offset + length), position)
                    } else {
                        for (var i = 0; i < length; i++) {
                            node.contents[position + i] = buffer[offset + i]
                        }
                    }
                    node.usedBytes = Math.max(node.usedBytes, position + length);
                    return length
                },
                llseek: function(stream, offset, whence) {
                    var position = offset;
                    if (whence === 1) {
                        position += stream.position
                    } else if (whence === 2) {
                        if (FS.isFile(stream.node.mode)) {
                            position += stream.node.usedBytes
                        }
                    }
                    if (position < 0) {
                        throw new FS.ErrnoError(28)
                    }
                    return position
                },
                allocate: function(stream, offset, length) {
                    MEMFS.expandFileStorage(stream.node, offset + length);
                    stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
                },
                mmap: function(stream, length, position, prot, flags) {
                    if (!FS.isFile(stream.node.mode)) {
                        throw new FS.ErrnoError(43)
                    }
                    var ptr;
                    var allocated;
                    var contents = stream.node.contents;
                    if (!(flags & 2) && contents.buffer === buffer) {
                        allocated = false;
                        ptr = contents.byteOffset
                    } else {
                        if (position > 0 || position + length < contents.length) {
                            if (contents.subarray) {
                                contents = contents.subarray(position, position + length)
                            } else {
                                contents = Array.prototype.slice.call(contents, position, position + length)
                            }
                        }
                        allocated = true;
                        ptr = mmapAlloc(length);
                        if (!ptr) {
                            throw new FS.ErrnoError(48)
                        }
                        HEAP8.set(contents, ptr)
                    }
                    return {
                        ptr: ptr,
                        allocated: allocated
                    }
                },
                msync: function(stream, buffer, offset, length, mmapFlags) {
                    MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
                    return 0
                }
            }
        };
        function asyncLoad(url, onload, onerror, noRunDep) {
            var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
            readAsync(url, arrayBuffer=>{
                assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
                onload(new Uint8Array(arrayBuffer));
                if (dep)
                    removeRunDependency(dep)
            }
            , event=>{
                if (onerror) {
                    onerror()
                } else {
                    throw 'Loading data file "' + url + '" failed.'
                }
            }
            );
            if (dep)
                addRunDependency(dep)
        }
        var IDBFS = {
            dbs: {},
            indexedDB: ()=>{
                if (typeof indexedDB != "undefined")
                    return indexedDB;
                var ret = null;
                if (typeof window == "object")
                    ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
                assert(ret, "IDBFS used, but indexedDB not supported");
                return ret
            }
            ,
            DB_VERSION: 21,
            DB_STORE_NAME: "FILE_DATA",
            mount: function(mount) {
                return MEMFS.mount.apply(null, arguments)
            },
            syncfs: (mount,populate,callback)=>{
                IDBFS.getLocalSet(mount, (err,local)=>{
                    if (err)
                        return callback(err);
                    IDBFS.getRemoteSet(mount, (err,remote)=>{
                        if (err)
                            return callback(err);
                        var src = populate ? remote : local;
                        var dst = populate ? local : remote;
                        IDBFS.reconcile(src, dst, callback)
                    }
                    )
                }
                )
            }
            ,
            quit: ()=>{
                Object.values(IDBFS.dbs).forEach(value=>value.close());
                IDBFS.dbs = {}
            }
            ,
            getDB: (name,callback)=>{
                var db = IDBFS.dbs[name];
                if (db) {
                    return callback(null, db)
                }
                var req;
                try {
                    req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
                } catch (e) {
                    return callback(e)
                }
                if (!req) {
                    return callback("Unable to connect to IndexedDB")
                }
                req.onupgradeneeded = e=>{
                    var db = e.target.result;
                    var transaction = e.target.transaction;
                    var fileStore;
                    if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
                        fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
                    } else {
                        fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
                    }
                    if (!fileStore.indexNames.contains("timestamp")) {
                        fileStore.createIndex("timestamp", "timestamp", {
                            unique: false
                        })
                    }
                }
                ;
                req.onsuccess = ()=>{
                    db = req.result;
                    IDBFS.dbs[name] = db;
                    callback(null, db)
                }
                ;
                req.onerror = e=>{
                    callback(this.error);
                    e.preventDefault()
                }
            }
            ,
            getLocalSet: (mount,callback)=>{
                var entries = {};
                function isRealDir(p) {
                    return p !== "." && p !== ".."
                }
                function toAbsolute(root) {
                    return p=>{
                        return PATH.join2(root, p)
                    }
                }
                var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
                while (check.length) {
                    var path = check.pop();
                    var stat;
                    try {
                        stat = FS.stat(path)
                    } catch (e) {
                        return callback(e)
                    }
                    if (FS.isDir(stat.mode)) {
                        check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
                    }
                    entries[path] = {
                        "timestamp": stat.mtime
                    }
                }
                return callback(null, {
                    type: "local",
                    entries: entries
                })
            }
            ,
            getRemoteSet: (mount,callback)=>{
                var entries = {};
                IDBFS.getDB(mount.mountpoint, (err,db)=>{
                    if (err)
                        return callback(err);
                    try {
                        var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
                        transaction.onerror = e=>{
                            callback(this.error);
                            e.preventDefault()
                        }
                        ;
                        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
                        var index = store.index("timestamp");
                        index.openKeyCursor().onsuccess = event=>{
                            var cursor = event.target.result;
                            if (!cursor) {
                                return callback(null, {
                                    type: "remote",
                                    db: db,
                                    entries: entries
                                })
                            }
                            entries[cursor.primaryKey] = {
                                "timestamp": cursor.key
                            };
                            cursor.continue()
                        }
                    } catch (e) {
                        return callback(e)
                    }
                }
                )
            }
            ,
            loadLocalEntry: (path,callback)=>{
                var stat, node;
                try {
                    var lookup = FS.lookupPath(path);
                    node = lookup.node;
                    stat = FS.stat(path)
                } catch (e) {
                    return callback(e)
                }
                if (FS.isDir(stat.mode)) {
                    return callback(null, {
                        "timestamp": stat.mtime,
                        "mode": stat.mode
                    })
                } else if (FS.isFile(stat.mode)) {
                    node.contents = MEMFS.getFileDataAsTypedArray(node);
                    return callback(null, {
                        "timestamp": stat.mtime,
                        "mode": stat.mode,
                        "contents": node.contents
                    })
                } else {
                    return callback(new Error("node type not supported"))
                }
            }
            ,
            storeLocalEntry: (path,entry,callback)=>{
                try {
                    if (FS.isDir(entry["mode"])) {
                        FS.mkdirTree(path, entry["mode"])
                    } else if (FS.isFile(entry["mode"])) {
                        FS.writeFile(path, entry["contents"], {
                            canOwn: true
                        })
                    } else {
                        return callback(new Error("node type not supported"))
                    }
                    FS.chmod(path, entry["mode"]);
                    FS.utime(path, entry["timestamp"], entry["timestamp"])
                } catch (e) {
                    return callback(e)
                }
                callback(null)
            }
            ,
            removeLocalEntry: (path,callback)=>{
                try {
                    var stat = FS.stat(path);
                    if (FS.isDir(stat.mode)) {
                        FS.rmdir(path)
                    } else if (FS.isFile(stat.mode)) {
                        FS.unlink(path)
                    }
                } catch (e) {
                    return callback(e)
                }
                callback(null)
            }
            ,
            loadRemoteEntry: (store,path,callback)=>{
                var req = store.get(path);
                req.onsuccess = event=>{
                    callback(null, event.target.result)
                }
                ;
                req.onerror = e=>{
                    callback(this.error);
                    e.preventDefault()
                }
            }
            ,
            storeRemoteEntry: (store,path,entry,callback)=>{
                try {
                    var req = store.put(entry, path)
                } catch (e) {
                    callback(e);
                    return
                }
                req.onsuccess = ()=>{
                    callback(null)
                }
                ;
                req.onerror = e=>{
                    callback(this.error);
                    e.preventDefault()
                }
            }
            ,
            removeRemoteEntry: (store,path,callback)=>{
                var req = store.delete(path);
                req.onsuccess = ()=>{
                    callback(null)
                }
                ;
                req.onerror = e=>{
                    callback(this.error);
                    e.preventDefault()
                }
            }
            ,
            reconcile: (src,dst,callback)=>{
                var total = 0;
                var create = [];
                Object.keys(src.entries).forEach(function(key) {
                    var e = src.entries[key];
                    var e2 = dst.entries[key];
                    if (!e2 || e["timestamp"].getTime() != e2["timestamp"].getTime()) {
                        create.push(key);
                        total++
                    }
                });
                var remove = [];
                Object.keys(dst.entries).forEach(function(key) {
                    if (!src.entries[key]) {
                        remove.push(key);
                        total++
                    }
                });
                if (!total) {
                    return callback(null)
                }
                var errored = false;
                var db = src.type === "remote" ? src.db : dst.db;
                var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
                var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
                function done(err) {
                    if (err && !errored) {
                        errored = true;
                        return callback(err)
                    }
                }
                transaction.onerror = e=>{
                    done(this.error);
                    e.preventDefault()
                }
                ;
                transaction.oncomplete = e=>{
                    if (!errored) {
                        callback(null)
                    }
                }
                ;
                create.sort().forEach(path=>{
                    if (dst.type === "local") {
                        IDBFS.loadRemoteEntry(store, path, (err,entry)=>{
                            if (err)
                                return done(err);
                            IDBFS.storeLocalEntry(path, entry, done)
                        }
                        )
                    } else {
                        IDBFS.loadLocalEntry(path, (err,entry)=>{
                            if (err)
                                return done(err);
                            IDBFS.storeRemoteEntry(store, path, entry, done)
                        }
                        )
                    }
                }
                );
                remove.sort().reverse().forEach(path=>{
                    if (dst.type === "local") {
                        IDBFS.removeLocalEntry(path, done)
                    } else {
                        IDBFS.removeRemoteEntry(store, path, done)
                    }
                }
                )
            }
        };
        var WORKERFS = {
            DIR_MODE: 16895,
            FILE_MODE: 33279,
            reader: null,
            mount: function(mount) {
                assert(ENVIRONMENT_IS_WORKER);
                if (!WORKERFS.reader)
                    WORKERFS.reader = new FileReaderSync;
                var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
                var createdParents = {};
                function ensureParent(path) {
                    var parts = path.split("/");
                    var parent = root;
                    for (var i = 0; i < parts.length - 1; i++) {
                        var curr = parts.slice(0, i + 1).join("/");
                        if (!createdParents[curr]) {
                            createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0)
                        }
                        parent = createdParents[curr]
                    }
                    return parent
                }
                function base(path) {
                    var parts = path.split("/");
                    return parts[parts.length - 1]
                }
                Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
                    WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate)
                });
                (mount.opts["blobs"] || []).forEach(function(obj) {
                    WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"])
                });
                (mount.opts["packages"] || []).forEach(function(pack) {
                    pack["metadata"].files.forEach(function(file) {
                        var name = file.filename.substr(1);
                        WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end))
                    })
                });
                return root
            },
            createNode: function(parent, name, mode, dev, contents, mtime) {
                var node = FS.createNode(parent, name, mode);
                node.mode = mode;
                node.node_ops = WORKERFS.node_ops;
                node.stream_ops = WORKERFS.stream_ops;
                node.timestamp = (mtime || new Date).getTime();
                assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
                if (mode === WORKERFS.FILE_MODE) {
                    node.size = contents.size;
                    node.contents = contents
                } else {
                    node.size = 4096;
                    node.contents = {}
                }
                if (parent) {
                    parent.contents[name] = node
                }
                return node
            },
            node_ops: {
                getattr: function(node) {
                    return {
                        dev: 1,
                        ino: node.id,
                        mode: node.mode,
                        nlink: 1,
                        uid: 0,
                        gid: 0,
                        rdev: undefined,
                        size: node.size,
                        atime: new Date(node.timestamp),
                        mtime: new Date(node.timestamp),
                        ctime: new Date(node.timestamp),
                        blksize: 4096,
                        blocks: Math.ceil(node.size / 4096)
                    }
                },
                setattr: function(node, attr) {
                    if (attr.mode !== undefined) {
                        node.mode = attr.mode
                    }
                    if (attr.timestamp !== undefined) {
                        node.timestamp = attr.timestamp
                    }
                },
                lookup: function(parent, name) {
                    throw new FS.ErrnoError(44)
                },
                mknod: function(parent, name, mode, dev) {
                    throw new FS.ErrnoError(63)
                },
                rename: function(oldNode, newDir, newName) {
                    throw new FS.ErrnoError(63)
                },
                unlink: function(parent, name) {
                    throw new FS.ErrnoError(63)
                },
                rmdir: function(parent, name) {
                    throw new FS.ErrnoError(63)
                },
                readdir: function(node) {
                    var entries = [".", ".."];
                    for (var key in node.contents) {
                        if (!node.contents.hasOwnProperty(key)) {
                            continue
                        }
                        entries.push(key)
                    }
                    return entries
                },
                symlink: function(parent, newName, oldPath) {
                    throw new FS.ErrnoError(63)
                },
                readlink: function(node) {
                    throw new FS.ErrnoError(63)
                }
            },
            stream_ops: {
                read: function(stream, buffer, offset, length, position) {
                    if (position >= stream.node.size)
                        return 0;
                    var chunk = stream.node.contents.slice(position, position + length);
                    var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
                    buffer.set(new Uint8Array(ab), offset);
                    return chunk.size
                },
                write: function(stream, buffer, offset, length, position) {
                    throw new FS.ErrnoError(29)
                },
                llseek: function(stream, offset, whence) {
                    var position = offset;
                    if (whence === 1) {
                        position += stream.position
                    } else if (whence === 2) {
                        if (FS.isFile(stream.node.mode)) {
                            position += stream.node.size
                        }
                    }
                    if (position < 0) {
                        throw new FS.ErrnoError(28)
                    }
                    return position
                }
            }
        };
        var FS = {
            root: null,
            mounts: [],
            devices: {},
            streams: [],
            nextInode: 1,
            nameTable: null,
            currentPath: "/",
            initialized: false,
            ignorePermissions: true,
            ErrnoError: null,
            genericErrors: {},
            filesystems: null,
            syncFSRequests: 0,
            lookupPath: (path,opts={})=>{
                path = PATH_FS.resolve(path);
                if (!path)
                    return {
                        path: "",
                        node: null
                    };
                var defaults = {
                    follow_mount: true,
                    recurse_count: 0
                };
                opts = Object.assign(defaults, opts);
                if (opts.recurse_count > 8) {
                    throw new FS.ErrnoError(32)
                }
                var parts = path.split("/").filter(p=>!!p);
                var current = FS.root;
                var current_path = "/";
                for (var i = 0; i < parts.length; i++) {
                    var islast = i === parts.length - 1;
                    if (islast && opts.parent) {
                        break
                    }
                    current = FS.lookupNode(current, parts[i]);
                    current_path = PATH.join2(current_path, parts[i]);
                    if (FS.isMountpoint(current)) {
                        if (!islast || islast && opts.follow_mount) {
                            current = current.mounted.root
                        }
                    }
                    if (!islast || opts.follow) {
                        var count = 0;
                        while (FS.isLink(current.mode)) {
                            var link = FS.readlink(current_path);
                            current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
                            var lookup = FS.lookupPath(current_path, {
                                recurse_count: opts.recurse_count + 1
                            });
                            current = lookup.node;
                            if (count++ > 40) {
                                throw new FS.ErrnoError(32)
                            }
                        }
                    }
                }
                return {
                    path: current_path,
                    node: current
                }
            }
            ,
            getPath: node=>{
                var path;
                while (true) {
                    if (FS.isRoot(node)) {
                        var mount = node.mount.mountpoint;
                        if (!path)
                            return mount;
                        return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
                    }
                    path = path ? node.name + "/" + path : node.name;
                    node = node.parent
                }
            }
            ,
            hashName: (parentid,name)=>{
                var hash = 0;
                for (var i = 0; i < name.length; i++) {
                    hash = (hash << 5) - hash + name.charCodeAt(i) | 0
                }
                return (parentid + hash >>> 0) % FS.nameTable.length
            }
            ,
            hashAddNode: node=>{
                var hash = FS.hashName(node.parent.id, node.name);
                node.name_next = FS.nameTable[hash];
                FS.nameTable[hash] = node
            }
            ,
            hashRemoveNode: node=>{
                var hash = FS.hashName(node.parent.id, node.name);
                if (FS.nameTable[hash] === node) {
                    FS.nameTable[hash] = node.name_next
                } else {
                    var current = FS.nameTable[hash];
                    while (current) {
                        if (current.name_next === node) {
                            current.name_next = node.name_next;
                            break
                        }
                        current = current.name_next
                    }
                }
            }
            ,
            lookupNode: (parent,name)=>{
                var errCode = FS.mayLookup(parent);
                if (errCode) {
                    throw new FS.ErrnoError(errCode,parent)
                }
                var hash = FS.hashName(parent.id, name);
                for (var node = FS.nameTable[hash]; node; node = node.name_next) {
                    var nodeName = node.name;
                    if (node.parent.id === parent.id && nodeName === name) {
                        return node
                    }
                }
                return FS.lookup(parent, name)
            }
            ,
            createNode: (parent,name,mode,rdev)=>{
                var node = new FS.FSNode(parent,name,mode,rdev);
                FS.hashAddNode(node);
                return node
            }
            ,
            destroyNode: node=>{
                FS.hashRemoveNode(node)
            }
            ,
            isRoot: node=>{
                return node === node.parent
            }
            ,
            isMountpoint: node=>{
                return !!node.mounted
            }
            ,
            isFile: mode=>{
                return (mode & 61440) === 32768
            }
            ,
            isDir: mode=>{
                return (mode & 61440) === 16384
            }
            ,
            isLink: mode=>{
                return (mode & 61440) === 40960
            }
            ,
            isChrdev: mode=>{
                return (mode & 61440) === 8192
            }
            ,
            isBlkdev: mode=>{
                return (mode & 61440) === 24576
            }
            ,
            isFIFO: mode=>{
                return (mode & 61440) === 4096
            }
            ,
            isSocket: mode=>{
                return (mode & 49152) === 49152
            }
            ,
            flagModes: {
                "r": 0,
                "r+": 2,
                "w": 577,
                "w+": 578,
                "a": 1089,
                "a+": 1090
            },
            modeStringToFlags: str=>{
                var flags = FS.flagModes[str];
                if (typeof flags == "undefined") {
                    throw new Error("Unknown file open mode: " + str)
                }
                return flags
            }
            ,
            flagsToPermissionString: flag=>{
                var perms = ["r", "w", "rw"][flag & 3];
                if (flag & 512) {
                    perms += "w"
                }
                return perms
            }
            ,
            nodePermissions: (node,perms)=>{
                if (FS.ignorePermissions) {
                    return 0
                }
                if (perms.includes("r") && !(node.mode & 292)) {
                    return 2
                } else if (perms.includes("w") && !(node.mode & 146)) {
                    return 2
                } else if (perms.includes("x") && !(node.mode & 73)) {
                    return 2
                }
                return 0
            }
            ,
            mayLookup: dir=>{
                var errCode = FS.nodePermissions(dir, "x");
                if (errCode)
                    return errCode;
                if (!dir.node_ops.lookup)
                    return 2;
                return 0
            }
            ,
            mayCreate: (dir,name)=>{
                try {
                    var node = FS.lookupNode(dir, name);
                    return 20
                } catch (e) {}
                return FS.nodePermissions(dir, "wx")
            }
            ,
            mayDelete: (dir,name,isdir)=>{
                var node;
                try {
                    node = FS.lookupNode(dir, name)
                } catch (e) {
                    return e.errno
                }
                var errCode = FS.nodePermissions(dir, "wx");
                if (errCode) {
                    return errCode
                }
                if (isdir) {
                    if (!FS.isDir(node.mode)) {
                        return 54
                    }
                    if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                        return 10
                    }
                } else {
                    if (FS.isDir(node.mode)) {
                        return 31
                    }
                }
                return 0
            }
            ,
            mayOpen: (node,flags)=>{
                if (!node) {
                    return 44
                }
                if (FS.isLink(node.mode)) {
                    return 32
                } else if (FS.isDir(node.mode)) {
                    if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
                        return 31
                    }
                }
                return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
            }
            ,
            MAX_OPEN_FDS: 4096,
            nextfd: (fd_start=0,fd_end=FS.MAX_OPEN_FDS)=>{
                for (var fd = fd_start; fd <= fd_end; fd++) {
                    if (!FS.streams[fd]) {
                        return fd
                    }
                }
                throw new FS.ErrnoError(33)
            }
            ,
            getStream: fd=>FS.streams[fd],
            createStream: (stream,fd_start,fd_end)=>{
                if (!FS.FSStream) {
                    FS.FSStream = function() {
                        this.shared = {}
                    }
                    ;
                    FS.FSStream.prototype = {};
                    Object.defineProperties(FS.FSStream.prototype, {
                        object: {
                            get: function() {
                                return this.node
                            },
                            set: function(val) {
                                this.node = val
                            }
                        },
                        isRead: {
                            get: function() {
                                return (this.flags & 2097155) !== 1
                            }
                        },
                        isWrite: {
                            get: function() {
                                return (this.flags & 2097155) !== 0
                            }
                        },
                        isAppend: {
                            get: function() {
                                return this.flags & 1024
                            }
                        },
                        flags: {
                            get: function() {
                                return this.shared.flags
                            },
                            set: function(val) {
                                this.shared.flags = val
                            }
                        },
                        position: {
                            get: function() {
                                return this.shared.position
                            },
                            set: function(val) {
                                this.shared.position = val
                            }
                        }
                    })
                }
                stream = Object.assign(new FS.FSStream, stream);
                var fd = FS.nextfd(fd_start, fd_end);
                stream.fd = fd;
                FS.streams[fd] = stream;
                return stream
            }
            ,
            closeStream: fd=>{
                FS.streams[fd] = null
            }
            ,
            chrdev_stream_ops: {
                open: stream=>{
                    var device = FS.getDevice(stream.node.rdev);
                    stream.stream_ops = device.stream_ops;
                    if (stream.stream_ops.open) {
                        stream.stream_ops.open(stream)
                    }
                }
                ,
                llseek: ()=>{
                    throw new FS.ErrnoError(70)
                }
            },
            major: dev=>dev >> 8,
            minor: dev=>dev & 255,
            makedev: (ma,mi)=>ma << 8 | mi,
            registerDevice: (dev,ops)=>{
                FS.devices[dev] = {
                    stream_ops: ops
                }
            }
            ,
            getDevice: dev=>FS.devices[dev],
            getMounts: mount=>{
                var mounts = [];
                var check = [mount];
                while (check.length) {
                    var m = check.pop();
                    mounts.push(m);
                    check.push.apply(check, m.mounts)
                }
                return mounts
            }
            ,
            syncfs: (populate,callback)=>{
                if (typeof populate == "function") {
                    callback = populate;
                    populate = false
                }
                FS.syncFSRequests++;
                if (FS.syncFSRequests > 1) {
                    err("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work")
                }
                var mounts = FS.getMounts(FS.root.mount);
                var completed = 0;
                function doCallback(errCode) {
                    FS.syncFSRequests--;
                    return callback(errCode)
                }
                function done(errCode) {
                    if (errCode) {
                        if (!done.errored) {
                            done.errored = true;
                            return doCallback(errCode)
                        }
                        return
                    }
                    if (++completed >= mounts.length) {
                        doCallback(null)
                    }
                }
                mounts.forEach(mount=>{
                    if (!mount.type.syncfs) {
                        return done(null)
                    }
                    mount.type.syncfs(mount, populate, done)
                }
                )
            }
            ,
            mount: (type,opts,mountpoint)=>{
                var root = mountpoint === "/";
                var pseudo = !mountpoint;
                var node;
                if (root && FS.root) {
                    throw new FS.ErrnoError(10)
                } else if (!root && !pseudo) {
                    var lookup = FS.lookupPath(mountpoint, {
                        follow_mount: false
                    });
                    mountpoint = lookup.path;
                    node = lookup.node;
                    if (FS.isMountpoint(node)) {
                        throw new FS.ErrnoError(10)
                    }
                    if (!FS.isDir(node.mode)) {
                        throw new FS.ErrnoError(54)
                    }
                }
                var mount = {
                    type: type,
                    opts: opts,
                    mountpoint: mountpoint,
                    mounts: []
                };
                var mountRoot = type.mount(mount);
                mountRoot.mount = mount;
                mount.root = mountRoot;
                if (root) {
                    FS.root = mountRoot
                } else if (node) {
                    node.mounted = mount;
                    if (node.mount) {
                        node.mount.mounts.push(mount)
                    }
                }
                return mountRoot
            }
            ,
            unmount: mountpoint=>{
                var lookup = FS.lookupPath(mountpoint, {
                    follow_mount: false
                });
                if (!FS.isMountpoint(lookup.node)) {
                    throw new FS.ErrnoError(28)
                }
                var node = lookup.node;
                var mount = node.mounted;
                var mounts = FS.getMounts(mount);
                Object.keys(FS.nameTable).forEach(hash=>{
                    var current = FS.nameTable[hash];
                    while (current) {
                        var next = current.name_next;
                        if (mounts.includes(current.mount)) {
                            FS.destroyNode(current)
                        }
                        current = next
                    }
                }
                );
                node.mounted = null;
                var idx = node.mount.mounts.indexOf(mount);
                node.mount.mounts.splice(idx, 1)
            }
            ,
            lookup: (parent,name)=>{
                return parent.node_ops.lookup(parent, name)
            }
            ,
            mknod: (path,mode,dev)=>{
                var lookup = FS.lookupPath(path, {
                    parent: true
                });
                var parent = lookup.node;
                var name = PATH.basename(path);
                if (!name || name === "." || name === "..") {
                    throw new FS.ErrnoError(28)
                }
                var errCode = FS.mayCreate(parent, name);
                if (errCode) {
                    throw new FS.ErrnoError(errCode)
                }
                if (!parent.node_ops.mknod) {
                    throw new FS.ErrnoError(63)
                }
                return parent.node_ops.mknod(parent, name, mode, dev)
            }
            ,
            create: (path,mode)=>{
                mode = mode !== undefined ? mode : 438;
                mode &= 4095;
                mode |= 32768;
                return FS.mknod(path, mode, 0)
            }
            ,
            mkdir: (path,mode)=>{
                mode = mode !== undefined ? mode : 511;
                mode &= 511 | 512;
                mode |= 16384;
                return FS.mknod(path, mode, 0)
            }
            ,
            mkdirTree: (path,mode)=>{
                var dirs = path.split("/");
                var d = "";
                for (var i = 0; i < dirs.length; ++i) {
                    if (!dirs[i])
                        continue;
                    d += "/" + dirs[i];
                    try {
                        FS.mkdir(d, mode)
                    } catch (e) {
                        if (e.errno != 20)
                            throw e
                    }
                }
            }
            ,
            mkdev: (path,mode,dev)=>{
                if (typeof dev == "undefined") {
                    dev = mode;
                    mode = 438
                }
                mode |= 8192;
                return FS.mknod(path, mode, dev)
            }
            ,
            symlink: (oldpath,newpath)=>{
                if (!PATH_FS.resolve(oldpath)) {
                    throw new FS.ErrnoError(44)
                }
                var lookup = FS.lookupPath(newpath, {
                    parent: true
                });
                var parent = lookup.node;
                if (!parent) {
                    throw new FS.ErrnoError(44)
                }
                var newname = PATH.basename(newpath);
                var errCode = FS.mayCreate(parent, newname);
                if (errCode) {
                    throw new FS.ErrnoError(errCode)
                }
                if (!parent.node_ops.symlink) {
                    throw new FS.ErrnoError(63)
                }
                return parent.node_ops.symlink(parent, newname, oldpath)
            }
            ,
            rename: (old_path,new_path)=>{
                var old_dirname = PATH.dirname(old_path);
                var new_dirname = PATH.dirname(new_path);
                var old_name = PATH.basename(old_path);
                var new_name = PATH.basename(new_path);
                var lookup, old_dir, new_dir;
                lookup = FS.lookupPath(old_path, {
                    parent: true
                });
                old_dir = lookup.node;
                lookup = FS.lookupPath(new_path, {
                    parent: true
                });
                new_dir = lookup.node;
                if (!old_dir || !new_dir)
                    throw new FS.ErrnoError(44);
                if (old_dir.mount !== new_dir.mount) {
                    throw new FS.ErrnoError(75)
                }
                var old_node = FS.lookupNode(old_dir, old_name);
                var relative = PATH_FS.relative(old_path, new_dirname);
                if (relative.charAt(0) !== ".") {
                    throw new FS.ErrnoError(28)
                }
                relative = PATH_FS.relative(new_path, old_dirname);
                if (relative.charAt(0) !== ".") {
                    throw new FS.ErrnoError(55)
                }
                var new_node;
                try {
                    new_node = FS.lookupNode(new_dir, new_name)
                } catch (e) {}
                if (old_node === new_node) {
                    return
                }
                var isdir = FS.isDir(old_node.mode);
                var errCode = FS.mayDelete(old_dir, old_name, isdir);
                if (errCode) {
                    throw new FS.ErrnoError(errCode)
                }
                errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
                if (errCode) {
                    throw new FS.ErrnoError(errCode)
                }
                if (!old_dir.node_ops.rename) {
                    throw new FS.ErrnoError(63)
                }
                if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
                    throw new FS.ErrnoError(10)
                }
                if (new_dir !== old_dir) {
                    errCode = FS.nodePermissions(old_dir, "w");
                    if (errCode) {
                        throw new FS.ErrnoError(errCode)
                    }
                }
                FS.hashRemoveNode(old_node);
                try {
                    old_dir.node_ops.rename(old_node, new_dir, new_name)
                } catch (e) {
                    throw e
                } finally {
                    FS.hashAddNode(old_node)
                }
            }
            ,
            rmdir: path=>{
                var lookup = FS.lookupPath(path, {
                    parent: true
                });
                var parent = lookup.node;
                var name = PATH.basename(path);
                var node = FS.lookupNode(parent, name);
                var errCode = FS.mayDelete(parent, name, true);
                if (errCode) {
                    throw new FS.ErrnoError(errCode)
                }
                if (!parent.node_ops.rmdir) {
                    throw new FS.ErrnoError(63)
                }
                if (FS.isMountpoint(node)) {
                    throw new FS.ErrnoError(10)
                }
                parent.node_ops.rmdir(parent, name);
                FS.destroyNode(node)
            }
            ,
            readdir: path=>{
                var lookup = FS.lookupPath(path, {
                    follow: true
                });
                var node = lookup.node;
                if (!node.node_ops.readdir) {
                    throw new FS.ErrnoError(54)
                }
                return node.node_ops.readdir(node)
            }
            ,
            unlink: path=>{
                var lookup = FS.lookupPath(path, {
                    parent: true
                });
                var parent = lookup.node;
                if (!parent) {
                    throw new FS.ErrnoError(44)
                }
                var name = PATH.basename(path);
                var node = FS.lookupNode(parent, name);
                var errCode = FS.mayDelete(parent, name, false);
                if (errCode) {
                    throw new FS.ErrnoError(errCode)
                }
                if (!parent.node_ops.unlink) {
                    throw new FS.ErrnoError(63)
                }
                if (FS.isMountpoint(node)) {
                    throw new FS.ErrnoError(10)
                }
                parent.node_ops.unlink(parent, name);
                FS.destroyNode(node)
            }
            ,
            readlink: path=>{
                var lookup = FS.lookupPath(path);
                var link = lookup.node;
                if (!link) {
                    throw new FS.ErrnoError(44)
                }
                if (!link.node_ops.readlink) {
                    throw new FS.ErrnoError(28)
                }
                return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
            }
            ,
            stat: (path,dontFollow)=>{
                var lookup = FS.lookupPath(path, {
                    follow: !dontFollow
                });
                var node = lookup.node;
                if (!node) {
                    throw new FS.ErrnoError(44)
                }
                if (!node.node_ops.getattr) {
                    throw new FS.ErrnoError(63)
                }
                return node.node_ops.getattr(node)
            }
            ,
            lstat: path=>{
                return FS.stat(path, true)
            }
            ,
            chmod: (path,mode,dontFollow)=>{
                var node;
                if (typeof path == "string") {
                    var lookup = FS.lookupPath(path, {
                        follow: !dontFollow
                    });
                    node = lookup.node
                } else {
                    node = path
                }
                if (!node.node_ops.setattr) {
                    throw new FS.ErrnoError(63)
                }
                node.node_ops.setattr(node, {
                    mode: mode & 4095 | node.mode & ~4095,
                    timestamp: Date.now()
                })
            }
            ,
            lchmod: (path,mode)=>{
                FS.chmod(path, mode, true)
            }
            ,
            fchmod: (fd,mode)=>{
                var stream = FS.getStream(fd);
                if (!stream) {
                    throw new FS.ErrnoError(8)
                }
                FS.chmod(stream.node, mode)
            }
            ,
            chown: (path,uid,gid,dontFollow)=>{
                var node;
                if (typeof path == "string") {
                    var lookup = FS.lookupPath(path, {
                        follow: !dontFollow
                    });
                    node = lookup.node
                } else {
                    node = path
                }
                if (!node.node_ops.setattr) {
                    throw new FS.ErrnoError(63)
                }
                node.node_ops.setattr(node, {
                    timestamp: Date.now()
                })
            }
            ,
            lchown: (path,uid,gid)=>{
                FS.chown(path, uid, gid, true)
            }
            ,
            fchown: (fd,uid,gid)=>{
                var stream = FS.getStream(fd);
                if (!stream) {
                    throw new FS.ErrnoError(8)
                }
                FS.chown(stream.node, uid, gid)
            }
            ,
            truncate: (path,len)=>{
                if (len < 0) {
                    throw new FS.ErrnoError(28)
                }
                var node;
                if (typeof path == "string") {
                    var lookup = FS.lookupPath(path, {
                        follow: true
                    });
                    node = lookup.node
                } else {
                    node = path
                }
                if (!node.node_ops.setattr) {
                    throw new FS.ErrnoError(63)
                }
                if (FS.isDir(node.mode)) {
                    throw new FS.ErrnoError(31)
                }
                if (!FS.isFile(node.mode)) {
                    throw new FS.ErrnoError(28)
                }
                var errCode = FS.nodePermissions(node, "w");
                if (errCode) {
                    throw new FS.ErrnoError(errCode)
                }
                node.node_ops.setattr(node, {
                    size: len,
                    timestamp: Date.now()
                })
            }
            ,
            ftruncate: (fd,len)=>{
                var stream = FS.getStream(fd);
                if (!stream) {
                    throw new FS.ErrnoError(8)
                }
                if ((stream.flags & 2097155) === 0) {
                    throw new FS.ErrnoError(28)
                }
                FS.truncate(stream.node, len)
            }
            ,
            utime: (path,atime,mtime)=>{
                var lookup = FS.lookupPath(path, {
                    follow: true
                });
                var node = lookup.node;
                node.node_ops.setattr(node, {
                    timestamp: Math.max(atime, mtime)
                })
            }
            ,
            open: (path,flags,mode)=>{
                if (path === "") {
                    throw new FS.ErrnoError(44)
                }
                flags = typeof flags == "string" ? FS.modeStringToFlags(flags) : flags;
                mode = typeof mode == "undefined" ? 438 : mode;
                if (flags & 64) {
                    mode = mode & 4095 | 32768
                } else {
                    mode = 0
                }
                var node;
                if (typeof path == "object") {
                    node = path
                } else {
                    path = PATH.normalize(path);
                    try {
                        var lookup = FS.lookupPath(path, {
                            follow: !(flags & 131072)
                        });
                        node = lookup.node
                    } catch (e) {}
                }
                var created = false;
                if (flags & 64) {
                    if (node) {
                        if (flags & 128) {
                            throw new FS.ErrnoError(20)
                        }
                    } else {
                        node = FS.mknod(path, mode, 0);
                        created = true
                    }
                }
                if (!node) {
                    throw new FS.ErrnoError(44)
                }
                if (FS.isChrdev(node.mode)) {
                    flags &= ~512
                }
                if (flags & 65536 && !FS.isDir(node.mode)) {
                    throw new FS.ErrnoError(54)
                }
                if (!created) {
                    var errCode = FS.mayOpen(node, flags);
                    if (errCode) {
                        throw new FS.ErrnoError(errCode)
                    }
                }
                if (flags & 512 && !created) {
                    FS.truncate(node, 0)
                }
                flags &= ~(128 | 512 | 131072);
                var stream = FS.createStream({
                    node: node,
                    path: FS.getPath(node),
                    flags: flags,
                    seekable: true,
                    position: 0,
                    stream_ops: node.stream_ops,
                    ungotten: [],
                    error: false
                });
                if (stream.stream_ops.open) {
                    stream.stream_ops.open(stream)
                }
                if (Module["logReadFiles"] && !(flags & 1)) {
                    if (!FS.readFiles)
                        FS.readFiles = {};
                    if (!(path in FS.readFiles)) {
                        FS.readFiles[path] = 1
                    }
                }
                return stream
            }
            ,
            close: stream=>{
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8)
                }
                if (stream.getdents)
                    stream.getdents = null;
                try {
                    if (stream.stream_ops.close) {
                        stream.stream_ops.close(stream)
                    }
                } catch (e) {
                    throw e
                } finally {
                    FS.closeStream(stream.fd)
                }
                stream.fd = null
            }
            ,
            isClosed: stream=>{
                return stream.fd === null
            }
            ,
            llseek: (stream,offset,whence)=>{
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8)
                }
                if (!stream.seekable || !stream.stream_ops.llseek) {
                    throw new FS.ErrnoError(70)
                }
                if (whence != 0 && whence != 1 && whence != 2) {
                    throw new FS.ErrnoError(28)
                }
                stream.position = stream.stream_ops.llseek(stream, offset, whence);
                stream.ungotten = [];
                return stream.position
            }
            ,
            read: (stream,buffer,offset,length,position)=>{
                if (length < 0 || position < 0) {
                    throw new FS.ErrnoError(28)
                }
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8)
                }
                if ((stream.flags & 2097155) === 1) {
                    throw new FS.ErrnoError(8)
                }
                if (FS.isDir(stream.node.mode)) {
                    throw new FS.ErrnoError(31)
                }
                if (!stream.stream_ops.read) {
                    throw new FS.ErrnoError(28)
                }
                var seeking = typeof position != "undefined";
                if (!seeking) {
                    position = stream.position
                } else if (!stream.seekable) {
                    throw new FS.ErrnoError(70)
                }
                var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
                if (!seeking)
                    stream.position += bytesRead;
                return bytesRead
            }
            ,
            write: (stream,buffer,offset,length,position,canOwn)=>{
                if (length < 0 || position < 0) {
                    throw new FS.ErrnoError(28)
                }
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8)
                }
                if ((stream.flags & 2097155) === 0) {
                    throw new FS.ErrnoError(8)
                }
                if (FS.isDir(stream.node.mode)) {
                    throw new FS.ErrnoError(31)
                }
                if (!stream.stream_ops.write) {
                    throw new FS.ErrnoError(28)
                }
                if (stream.seekable && stream.flags & 1024) {
                    FS.llseek(stream, 0, 2)
                }
                var seeking = typeof position != "undefined";
                if (!seeking) {
                    position = stream.position
                } else if (!stream.seekable) {
                    throw new FS.ErrnoError(70)
                }
                var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
                if (!seeking)
                    stream.position += bytesWritten;
                return bytesWritten
            }
            ,
            allocate: (stream,offset,length)=>{
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8)
                }
                if (offset < 0 || length <= 0) {
                    throw new FS.ErrnoError(28)
                }
                if ((stream.flags & 2097155) === 0) {
                    throw new FS.ErrnoError(8)
                }
                if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
                    throw new FS.ErrnoError(43)
                }
                if (!stream.stream_ops.allocate) {
                    throw new FS.ErrnoError(138)
                }
                stream.stream_ops.allocate(stream, offset, length)
            }
            ,
            mmap: (stream,length,position,prot,flags)=>{
                if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
                    throw new FS.ErrnoError(2)
                }
                if ((stream.flags & 2097155) === 1) {
                    throw new FS.ErrnoError(2)
                }
                if (!stream.stream_ops.mmap) {
                    throw new FS.ErrnoError(43)
                }
                return stream.stream_ops.mmap(stream, length, position, prot, flags)
            }
            ,
            msync: (stream,buffer,offset,length,mmapFlags)=>{
                if (!stream.stream_ops.msync) {
                    return 0
                }
                return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
            }
            ,
            munmap: stream=>0,
            ioctl: (stream,cmd,arg)=>{
                if (!stream.stream_ops.ioctl) {
                    throw new FS.ErrnoError(59)
                }
                return stream.stream_ops.ioctl(stream, cmd, arg)
            }
            ,
            readFile: (path,opts={})=>{
                opts.flags = opts.flags || 0;
                opts.encoding = opts.encoding || "binary";
                if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
                    throw new Error('Invalid encoding type "' + opts.encoding + '"')
                }
                var ret;
                var stream = FS.open(path, opts.flags);
                var stat = FS.stat(path);
                var length = stat.size;
                var buf = new Uint8Array(length);
                FS.read(stream, buf, 0, length, 0);
                if (opts.encoding === "utf8") {
                    ret = UTF8ArrayToString(buf, 0)
                } else if (opts.encoding === "binary") {
                    ret = buf
                }
                FS.close(stream);
                return ret
            }
            ,
            writeFile: (path,data,opts={})=>{
                opts.flags = opts.flags || 577;
                var stream = FS.open(path, opts.flags, opts.mode);
                if (typeof data == "string") {
                    var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
                    var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
                    FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
                } else if (ArrayBuffer.isView(data)) {
                    FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
                } else {
                    throw new Error("Unsupported data type")
                }
                FS.close(stream)
            }
            ,
            cwd: ()=>FS.currentPath,
            chdir: path=>{
                var lookup = FS.lookupPath(path, {
                    follow: true
                });
                if (lookup.node === null) {
                    throw new FS.ErrnoError(44)
                }
                if (!FS.isDir(lookup.node.mode)) {
                    throw new FS.ErrnoError(54)
                }
                var errCode = FS.nodePermissions(lookup.node, "x");
                if (errCode) {
                    throw new FS.ErrnoError(errCode)
                }
                FS.currentPath = lookup.path
            }
            ,
            createDefaultDirectories: ()=>{
                FS.mkdir("/tmp");
                FS.mkdir("/home");
                FS.mkdir("/home/web_user")
            }
            ,
            createDefaultDevices: ()=>{
                FS.mkdir("/dev");
                FS.registerDevice(FS.makedev(1, 3), {
                    read: ()=>0,
                    write: (stream,buffer,offset,length,pos)=>length
                });
                FS.mkdev("/dev/null", FS.makedev(1, 3));
                TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
                TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
                FS.mkdev("/dev/tty", FS.makedev(5, 0));
                FS.mkdev("/dev/tty1", FS.makedev(6, 0));
                var random_device = getRandomDevice();
                FS.createDevice("/dev", "random", random_device);
                FS.createDevice("/dev", "urandom", random_device);
                FS.mkdir("/dev/shm");
                FS.mkdir("/dev/shm/tmp")
            }
            ,
            createSpecialDirectories: ()=>{
                FS.mkdir("/proc");
                var proc_self = FS.mkdir("/proc/self");
                FS.mkdir("/proc/self/fd");
                FS.mount({
                    mount: ()=>{
                        var node = FS.createNode(proc_self, "fd", 16384 | 511, 73);
                        node.node_ops = {
                            lookup: (parent,name)=>{
                                var fd = +name;
                                var stream = FS.getStream(fd);
                                if (!stream)
                                    throw new FS.ErrnoError(8);
                                var ret = {
                                    parent: null,
                                    mount: {
                                        mountpoint: "fake"
                                    },
                                    node_ops: {
                                        readlink: ()=>stream.path
                                    }
                                };
                                ret.parent = ret;
                                return ret
                            }
                        };
                        return node
                    }
                }, {}, "/proc/self/fd")
            }
            ,
            createStandardStreams: ()=>{
                if (Module["stdin"]) {
                    FS.createDevice("/dev", "stdin", Module["stdin"])
                } else {
                    FS.symlink("/dev/tty", "/dev/stdin")
                }
                if (Module["stdout"]) {
                    FS.createDevice("/dev", "stdout", null, Module["stdout"])
                } else {
                    FS.symlink("/dev/tty", "/dev/stdout")
                }
                if (Module["stderr"]) {
                    FS.createDevice("/dev", "stderr", null, Module["stderr"])
                } else {
                    FS.symlink("/dev/tty1", "/dev/stderr")
                }
                var stdin = FS.open("/dev/stdin", 0);
                var stdout = FS.open("/dev/stdout", 1);
                var stderr = FS.open("/dev/stderr", 1)
            }
            ,
            ensureErrnoError: ()=>{
                if (FS.ErrnoError)
                    return;
                FS.ErrnoError = function ErrnoError(errno, node) {
                    this.node = node;
                    this.setErrno = function(errno) {
                        this.errno = errno
                    }
                    ;
                    this.setErrno(errno);
                    this.message = "FS error"
                }
                ;
                FS.ErrnoError.prototype = new Error;
                FS.ErrnoError.prototype.constructor = FS.ErrnoError;
                [44].forEach(code=>{
                    FS.genericErrors[code] = new FS.ErrnoError(code);
                    FS.genericErrors[code].stack = "<generic error, no stack>"
                }
                )
            }
            ,
            staticInit: ()=>{
                FS.ensureErrnoError();
                FS.nameTable = new Array(4096);
                FS.mount(MEMFS, {}, "/");
                FS.createDefaultDirectories();
                FS.createDefaultDevices();
                FS.createSpecialDirectories();
                FS.filesystems = {
                    "MEMFS": MEMFS,
                    "IDBFS": IDBFS,
                    "WORKERFS": WORKERFS
                }
            }
            ,
            init: (input,output,error)=>{
                FS.init.initialized = true;
                FS.ensureErrnoError();
                Module["stdin"] = input || Module["stdin"];
                Module["stdout"] = output || Module["stdout"];
                Module["stderr"] = error || Module["stderr"];
                FS.createStandardStreams()
            }
            ,
            quit: ()=>{
                FS.init.initialized = false;
                for (var i = 0; i < FS.streams.length; i++) {
                    var stream = FS.streams[i];
                    if (!stream) {
                        continue
                    }
                    FS.close(stream)
                }
            }
            ,
            getMode: (canRead,canWrite)=>{
                var mode = 0;
                if (canRead)
                    mode |= 292 | 73;
                if (canWrite)
                    mode |= 146;
                return mode
            }
            ,
            findObject: (path,dontResolveLastLink)=>{
                var ret = FS.analyzePath(path, dontResolveLastLink);
                if (!ret.exists) {
                    return null
                }
                return ret.object
            }
            ,
            analyzePath: (path,dontResolveLastLink)=>{
                try {
                    var lookup = FS.lookupPath(path, {
                        follow: !dontResolveLastLink
                    });
                    path = lookup.path
                } catch (e) {}
                var ret = {
                    isRoot: false,
                    exists: false,
                    error: 0,
                    name: null,
                    path: null,
                    object: null,
                    parentExists: false,
                    parentPath: null,
                    parentObject: null
                };
                try {
                    var lookup = FS.lookupPath(path, {
                        parent: true
                    });
                    ret.parentExists = true;
                    ret.parentPath = lookup.path;
                    ret.parentObject = lookup.node;
                    ret.name = PATH.basename(path);
                    lookup = FS.lookupPath(path, {
                        follow: !dontResolveLastLink
                    });
                    ret.exists = true;
                    ret.path = lookup.path;
                    ret.object = lookup.node;
                    ret.name = lookup.node.name;
                    ret.isRoot = lookup.path === "/"
                } catch (e) {
                    ret.error = e.errno
                }
                return ret
            }
            ,
            createPath: (parent,path,canRead,canWrite)=>{
                parent = typeof parent == "string" ? parent : FS.getPath(parent);
                var parts = path.split("/").reverse();
                while (parts.length) {
                    var part = parts.pop();
                    if (!part)
                        continue;
                    var current = PATH.join2(parent, part);
                    try {
                        FS.mkdir(current)
                    } catch (e) {}
                    parent = current
                }
                return current
            }
            ,
            createFile: (parent,name,properties,canRead,canWrite)=>{
                var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
                var mode = FS.getMode(canRead, canWrite);
                return FS.create(path, mode)
            }
            ,
            createDataFile: (parent,name,data,canRead,canWrite,canOwn)=>{
                var path = name;
                if (parent) {
                    parent = typeof parent == "string" ? parent : FS.getPath(parent);
                    path = name ? PATH.join2(parent, name) : parent
                }
                var mode = FS.getMode(canRead, canWrite);
                var node = FS.create(path, mode);
                if (data) {
                    if (typeof data == "string") {
                        var arr = new Array(data.length);
                        for (var i = 0, len = data.length; i < len; ++i)
                            arr[i] = data.charCodeAt(i);
                        data = arr
                    }
                    FS.chmod(node, mode | 146);
                    var stream = FS.open(node, 577);
                    FS.write(stream, data, 0, data.length, 0, canOwn);
                    FS.close(stream);
                    FS.chmod(node, mode)
                }
                return node
            }
            ,
            createDevice: (parent,name,input,output)=>{
                var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
                var mode = FS.getMode(!!input, !!output);
                if (!FS.createDevice.major)
                    FS.createDevice.major = 64;
                var dev = FS.makedev(FS.createDevice.major++, 0);
                FS.registerDevice(dev, {
                    open: stream=>{
                        stream.seekable = false
                    }
                    ,
                    close: stream=>{
                        if (output && output.buffer && output.buffer.length) {
                            output(10)
                        }
                    }
                    ,
                    read: (stream,buffer,offset,length,pos)=>{
                        var bytesRead = 0;
                        for (var i = 0; i < length; i++) {
                            var result;
                            try {
                                result = input()
                            } catch (e) {
                                throw new FS.ErrnoError(29)
                            }
                            if (result === undefined && bytesRead === 0) {
                                throw new FS.ErrnoError(6)
                            }
                            if (result === null || result === undefined)
                                break;
                            bytesRead++;
                            buffer[offset + i] = result
                        }
                        if (bytesRead) {
                            stream.node.timestamp = Date.now()
                        }
                        return bytesRead
                    }
                    ,
                    write: (stream,buffer,offset,length,pos)=>{
                        for (var i = 0; i < length; i++) {
                            try {
                                output(buffer[offset + i])
                            } catch (e) {
                                throw new FS.ErrnoError(29)
                            }
                        }
                        if (length) {
                            stream.node.timestamp = Date.now()
                        }
                        return i
                    }
                });
                return FS.mkdev(path, mode, dev)
            }
            ,
            forceLoadFile: obj=>{
                if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
                    return true;
                if (typeof XMLHttpRequest != "undefined") {
                    throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
                } else if (read_) {
                    try {
                        obj.contents = intArrayFromString(read_(obj.url), true);
                        obj.usedBytes = obj.contents.length
                    } catch (e) {
                        throw new FS.ErrnoError(29)
                    }
                } else {
                    throw new Error("Cannot load without read() or XMLHttpRequest.")
                }
            }
            ,
            //////////////////////////////////////////////////////////////////////////////////////////////
            // jfm
            createLazyFile: (parent,name,url,canRead,canWrite,headResponseHeaders,chunkSize)=>{
            //////////////////////////////////////////////////////////////////////////////////////////////
                function LazyUint8Array() {
                    this.lengthKnown = false;
                    // this.chunks = []
                    this.chunks = {} // jfm
                }
                LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
                    if (idx > this.length - 1 || idx < 0) {
                        return undefined
                    }
                    var chunkOffset = idx % this.chunkSize;
                    var chunkNum = idx / this.chunkSize | 0;
                    return this.getter(chunkNum)[chunkOffset]
                }
                ;
                LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
                    this.getter = getter
                }
                ;
                LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
                    //////////////////////////////////////////////////////////////////////////////////////////////
                    // jfm
                    // skip the head check, because it is not allowed by CORS on DANDI AWS bucket
                    // var xhr = new XMLHttpRequest;
                    // xhr.open("HEAD", url, false);
                    // xhr.send(null);
                    // if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                    //     throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                    // var datalength = Number(xhr.getResponseHeader("Content-length"));
                    // var header;
                    // var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
                    // var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";

                    var datalength = Number(headResponseHeaders["Content-length"]);
                    var header;
                    var hasByteServing = (header = headResponseHeaders["Accept-Ranges"]) && header === "bytes";
                    var usesGzip = (header = headResponseHeaders["Content-Encoding"]) && header === "gzip";
                    if (!hasByteServing) {
                        throw Error('We are not going to support hasByteServing = false')
                    }

                    // var chunkSize = 1024 * 1024;
                    //////////////////////////////////////////////////////////////////////////////////////////////

                    if (!hasByteServing)
                        chunkSize = datalength;
                    var doXHR = (from,to)=>{
                        if (from > to)
                            throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
                        if (to > datalength - 1)
                            throw new Error("only " + datalength + " bytes available! programmer error!");
                        var xhr = new XMLHttpRequest;
                        xhr.open("GET", url, false);
                        if (datalength !== chunkSize)
                            xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
                        xhr.responseType = "arraybuffer";
                        if (xhr.overrideMimeType) {
                            xhr.overrideMimeType("text/plain; charset=x-user-defined")
                        }
                        xhr.send(null);
                        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                            throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                        if (xhr.response !== undefined) {
                            return new Uint8Array(xhr.response || [])
                        }
                        return intArrayFromString(xhr.responseText || "", true)
                    }
                    ;
                    var lazyArray = this;
                    lazyArray.setDataGetter(chunkNum=>{
                        var start = chunkNum * chunkSize;
                        var end = (chunkNum + 1) * chunkSize - 1;
                        end = Math.min(end, datalength - 1);
                        if (typeof lazyArray.chunks[chunkNum] == "undefined") {
                            lazyArray.chunks[chunkNum] = doXHR(start, end)
                        }
                        if (typeof lazyArray.chunks[chunkNum] == "undefined")
                            throw new Error("doXHR failed!");
                        return lazyArray.chunks[chunkNum]
                    }
                    );
                    if (usesGzip || !datalength) {
                        chunkSize = datalength = 1;
                        datalength = this.getter(0).length;
                        chunkSize = datalength;
                        out("LazyFiles on gzip forces download of the whole file when length is accessed")
                    }
                    this._length = datalength;
                    this._chunkSize = chunkSize;
                    this.lengthKnown = true
                }
                ;
                if (typeof XMLHttpRequest != "undefined") {
                    if (!ENVIRONMENT_IS_WORKER)
                        throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
                    var lazyArray = new LazyUint8Array;
                    Object.defineProperties(lazyArray, {
                        length: {
                            get: function() {
                                if (!this.lengthKnown) {
                                    this.cacheLength()
                                }
                                return this._length
                            }
                        },
                        chunkSize: {
                            get: function() {
                                if (!this.lengthKnown) {
                                    this.cacheLength()
                                }
                                return this._chunkSize
                            }
                        }
                    });
                    var properties = {
                        isDevice: false,
                        contents: lazyArray
                    }
                } else {
                    var properties = {
                        isDevice: false,
                        url: url
                    }
                }
                var node = FS.createFile(parent, name, properties, canRead, canWrite);
                if (properties.contents) {
                    node.contents = properties.contents
                } else if (properties.url) {
                    node.contents = null;
                    node.url = properties.url
                }
                Object.defineProperties(node, {
                    usedBytes: {
                        get: function() {
                            return this.contents.length
                        }
                    }
                });
                var stream_ops = {};
                var keys = Object.keys(node.stream_ops);
                keys.forEach(key=>{
                    var fn = node.stream_ops[key];
                    stream_ops[key] = function forceLoadLazyFile() {
                        FS.forceLoadFile(node);
                        return fn.apply(null, arguments)
                    }
                }
                );
                function writeChunks(stream, buffer, offset, length, position) {
                    var contents = stream.node.contents;
                    if (position >= contents.length)
                        return 0;
                    var size = Math.min(contents.length - position, length);
                    if (contents.slice) {
                        for (var i = 0; i < size; i++) {
                            buffer[offset + i] = contents[position + i]
                        }
                    } else {
                        for (var i = 0; i < size; i++) {
                            buffer[offset + i] = contents.get(position + i)
                        }
                    }
                    return size
                }
                stream_ops.read = (stream,buffer,offset,length,position)=>{
                    FS.forceLoadFile(node);
                    return writeChunks(stream, buffer, offset, length, position)
                }
                ;
                stream_ops.mmap = (stream,length,position,prot,flags)=>{
                    FS.forceLoadFile(node);
                    var ptr = mmapAlloc(length);
                    if (!ptr) {
                        throw new FS.ErrnoError(48)
                    }
                    writeChunks(stream, HEAP8, ptr, length, position);
                    return {
                        ptr: ptr,
                        allocated: true
                    }
                }
                ;
                node.stream_ops = stream_ops;
                return node
            }
            ,
            createPreloadedFile: (parent,name,url,canRead,canWrite,onload,onerror,dontCreateFile,canOwn,preFinish)=>{
                var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
                var dep = getUniqueRunDependency("cp " + fullname);
                function processData(byteArray) {
                    function finish(byteArray) {
                        if (preFinish)
                            preFinish();
                        if (!dontCreateFile) {
                            FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
                        }
                        if (onload)
                            onload();
                        removeRunDependency(dep)
                    }
                    if (Browser.handledByPreloadPlugin(byteArray, fullname, finish, ()=>{
                        if (onerror)
                            onerror();
                        removeRunDependency(dep)
                    }
                    )) {
                        return
                    }
                    finish(byteArray)
                }
                addRunDependency(dep);
                if (typeof url == "string") {
                    asyncLoad(url, byteArray=>processData(byteArray), onerror)
                } else {
                    processData(url)
                }
            }
            ,
            indexedDB: ()=>{
                return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
            }
            ,
            DB_NAME: ()=>{
                return "EM_FS_" + window.location.pathname
            }
            ,
            DB_VERSION: 20,
            DB_STORE_NAME: "FILE_DATA",
            saveFilesToDB: (paths,onload,onerror)=>{
                onload = onload || (()=>{}
                );
                onerror = onerror || (()=>{}
                );
                var indexedDB = FS.indexedDB();
                try {
                    var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
                } catch (e) {
                    return onerror(e)
                }
                openRequest.onupgradeneeded = ()=>{
                    out("creating db");
                    var db = openRequest.result;
                    db.createObjectStore(FS.DB_STORE_NAME)
                }
                ;
                openRequest.onsuccess = ()=>{
                    var db = openRequest.result;
                    var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
                    var files = transaction.objectStore(FS.DB_STORE_NAME);
                    var ok = 0
                      , fail = 0
                      , total = paths.length;
                    function finish() {
                        if (fail == 0)
                            onload();
                        else
                            onerror()
                    }
                    paths.forEach(path=>{
                        var putRequest = files.put(FS.analyzePath(path).object.contents, path);
                        putRequest.onsuccess = ()=>{
                            ok++;
                            if (ok + fail == total)
                                finish()
                        }
                        ;
                        putRequest.onerror = ()=>{
                            fail++;
                            if (ok + fail == total)
                                finish()
                        }
                    }
                    );
                    transaction.onerror = onerror
                }
                ;
                openRequest.onerror = onerror
            }
            ,
            loadFilesFromDB: (paths,onload,onerror)=>{
                onload = onload || (()=>{}
                );
                onerror = onerror || (()=>{}
                );
                var indexedDB = FS.indexedDB();
                try {
                    var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
                } catch (e) {
                    return onerror(e)
                }
                openRequest.onupgradeneeded = onerror;
                openRequest.onsuccess = ()=>{
                    var db = openRequest.result;
                    try {
                        var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
                    } catch (e) {
                        onerror(e);
                        return
                    }
                    var files = transaction.objectStore(FS.DB_STORE_NAME);
                    var ok = 0
                      , fail = 0
                      , total = paths.length;
                    function finish() {
                        if (fail == 0)
                            onload();
                        else
                            onerror()
                    }
                    paths.forEach(path=>{
                        var getRequest = files.get(path);
                        getRequest.onsuccess = ()=>{
                            if (FS.analyzePath(path).exists) {
                                FS.unlink(path)
                            }
                            FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                            ok++;
                            if (ok + fail == total)
                                finish()
                        }
                        ;
                        getRequest.onerror = ()=>{
                            fail++;
                            if (ok + fail == total)
                                finish()
                        }
                    }
                    );
                    transaction.onerror = onerror
                }
                ;
                openRequest.onerror = onerror
            }
        };
        var SYSCALLS = {
            DEFAULT_POLLMASK: 5,
            calculateAt: function(dirfd, path, allowEmpty) {
                if (PATH.isAbs(path)) {
                    return path
                }
                var dir;
                if (dirfd === -100) {
                    dir = FS.cwd()
                } else {
                    var dirstream = SYSCALLS.getStreamFromFD(dirfd);
                    dir = dirstream.path
                }
                if (path.length == 0) {
                    if (!allowEmpty) {
                        throw new FS.ErrnoError(44)
                    }
                    return dir
                }
                return PATH.join2(dir, path)
            },
            doStat: function(func, path, buf) {
                try {
                    var stat = func(path)
                } catch (e) {
                    if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
                        return -54
                    }
                    throw e
                }
                HEAP32[buf >> 2] = stat.dev;
                HEAP32[buf + 8 >> 2] = stat.ino;
                HEAP32[buf + 12 >> 2] = stat.mode;
                HEAPU32[buf + 16 >> 2] = stat.nlink;
                HEAP32[buf + 20 >> 2] = stat.uid;
                HEAP32[buf + 24 >> 2] = stat.gid;
                HEAP32[buf + 28 >> 2] = stat.rdev;
                tempI64 = [stat.size >>> 0, (tempDouble = stat.size,
                +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                HEAP32[buf + 40 >> 2] = tempI64[0],
                HEAP32[buf + 44 >> 2] = tempI64[1];
                HEAP32[buf + 48 >> 2] = 4096;
                HEAP32[buf + 52 >> 2] = stat.blocks;
                var atime = stat.atime.getTime();
                var mtime = stat.mtime.getTime();
                var ctime = stat.ctime.getTime();
                tempI64 = [Math.floor(atime / 1e3) >>> 0, (tempDouble = Math.floor(atime / 1e3),
                +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                HEAP32[buf + 56 >> 2] = tempI64[0],
                HEAP32[buf + 60 >> 2] = tempI64[1];
                HEAPU32[buf + 64 >> 2] = atime % 1e3 * 1e3;
                tempI64 = [Math.floor(mtime / 1e3) >>> 0, (tempDouble = Math.floor(mtime / 1e3),
                +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                HEAP32[buf + 72 >> 2] = tempI64[0],
                HEAP32[buf + 76 >> 2] = tempI64[1];
                HEAPU32[buf + 80 >> 2] = mtime % 1e3 * 1e3;
                tempI64 = [Math.floor(ctime / 1e3) >>> 0, (tempDouble = Math.floor(ctime / 1e3),
                +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                HEAP32[buf + 88 >> 2] = tempI64[0],
                HEAP32[buf + 92 >> 2] = tempI64[1];
                HEAPU32[buf + 96 >> 2] = ctime % 1e3 * 1e3;
                tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino,
                +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                HEAP32[buf + 104 >> 2] = tempI64[0],
                HEAP32[buf + 108 >> 2] = tempI64[1];
                return 0
            },
            doMsync: function(addr, stream, len, flags, offset) {
                if (!FS.isFile(stream.node.mode)) {
                    throw new FS.ErrnoError(43)
                }
                if (flags & 2) {
                    return 0
                }
                var buffer = HEAPU8.slice(addr, addr + len);
                FS.msync(stream, buffer, offset, len, flags)
            },
            varargs: undefined,
            get: function() {
                SYSCALLS.varargs += 4;
                var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
                return ret
            },
            getStr: function(ptr) {
                var ret = UTF8ToString(ptr);
                return ret
            },
            getStreamFromFD: function(fd) {
                var stream = FS.getStream(fd);
                if (!stream)
                    throw new FS.ErrnoError(8);
                return stream
            }
        };
        function ___syscall_faccessat(dirfd, path, amode, flags) {
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);
                if (amode & ~7) {
                    return -28
                }
                var lookup = FS.lookupPath(path, {
                    follow: true
                });
                var node = lookup.node;
                if (!node) {
                    return -44
                }
                var perms = "";
                if (amode & 4)
                    perms += "r";
                if (amode & 2)
                    perms += "w";
                if (amode & 1)
                    perms += "x";
                if (perms && FS.nodePermissions(node, perms)) {
                    return -2
                }
                return 0
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_faccessat.sig = "iipii";
        function setErrNo(value) {
            HEAP32[___errno_location() >> 2] = value;
            return value
        }
        function ___syscall_fcntl64(fd, cmd, varargs) {
            SYSCALLS.varargs = varargs;
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                switch (cmd) {
                case 0:
                    {
                        var arg = SYSCALLS.get();
                        if (arg < 0) {
                            return -28
                        }
                        var newStream;
                        newStream = FS.createStream(stream, arg);
                        return newStream.fd
                    }
                case 1:
                case 2:
                    return 0;
                case 3:
                    return stream.flags;
                case 4:
                    {
                        var arg = SYSCALLS.get();
                        stream.flags |= arg;
                        return 0
                    }
                case 5:
                    {
                        var arg = SYSCALLS.get();
                        var offset = 0;
                        HEAP16[arg + offset >> 1] = 2;
                        return 0
                    }
                case 6:
                case 7:
                    return 0;
                case 16:
                case 8:
                    return -28;
                case 9:
                    setErrNo(28);
                    return -1;
                default:
                    {
                        return -28
                    }
                }
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_fcntl64.sig = "iiip";
        function ___syscall_fstat64(fd, buf) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                return SYSCALLS.doStat(FS.stat, stream.path, buf)
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_fstat64.sig = "iip";
        var MAX_INT53 = 9007199254740992;
        var MIN_INT53 = -9007199254740992;
        function bigintToI53Checked(num) {
            return num < MIN_INT53 || num > MAX_INT53 ? NaN : Number(num)
        }
        function ___syscall_ftruncate64(fd, length) {
            try {
                length = bigintToI53Checked(length);
                if (isNaN(length))
                    return -61;
                FS.ftruncate(fd, length);
                return 0
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_ftruncate64.sig = "iij";
        function ___syscall_getcwd(buf, size) {
            try {
                if (size === 0)
                    return -28;
                var cwd = FS.cwd();
                var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
                if (size < cwdLengthInBytes)
                    return -68;
                stringToUTF8(cwd, buf, size);
                return cwdLengthInBytes
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_getcwd.sig = "ipp";
        function ___syscall_getdents64(fd, dirp, count) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                if (!stream.getdents) {
                    stream.getdents = FS.readdir(stream.path)
                }
                var struct_size = 280;
                var pos = 0;
                var off = FS.llseek(stream, 0, 1);
                var idx = Math.floor(off / struct_size);
                while (idx < stream.getdents.length && pos + struct_size <= count) {
                    var id;
                    var type;
                    var name = stream.getdents[idx];
                    if (name === ".") {
                        id = stream.node.id;
                        type = 4
                    } else if (name === "..") {
                        var lookup = FS.lookupPath(stream.path, {
                            parent: true
                        });
                        id = lookup.node.id;
                        type = 4
                    } else {
                        var child = FS.lookupNode(stream.node, name);
                        id = child.id;
                        type = FS.isChrdev(child.mode) ? 2 : FS.isDir(child.mode) ? 4 : FS.isLink(child.mode) ? 10 : 8
                    }
                    tempI64 = [id >>> 0, (tempDouble = id,
                    +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                    HEAP32[dirp + pos >> 2] = tempI64[0],
                    HEAP32[dirp + pos + 4 >> 2] = tempI64[1];
                    tempI64 = [(idx + 1) * struct_size >>> 0, (tempDouble = (idx + 1) * struct_size,
                    +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                    HEAP32[dirp + pos + 8 >> 2] = tempI64[0],
                    HEAP32[dirp + pos + 12 >> 2] = tempI64[1];
                    HEAP16[dirp + pos + 16 >> 1] = 280;
                    HEAP8[dirp + pos + 18 >> 0] = type;
                    stringToUTF8(name, dirp + pos + 19, 256);
                    pos += struct_size;
                    idx += 1
                }
                FS.llseek(stream, idx * struct_size, 0);
                return pos
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_getdents64.sig = "iipi";
        function ___syscall_ioctl(fd, op, varargs) {
            SYSCALLS.varargs = varargs;
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                switch (op) {
                case 21509:
                case 21505:
                    {
                        if (!stream.tty)
                            return -59;
                        return 0
                    }
                case 21510:
                case 21511:
                case 21512:
                case 21506:
                case 21507:
                case 21508:
                    {
                        if (!stream.tty)
                            return -59;
                        return 0
                    }
                case 21519:
                    {
                        if (!stream.tty)
                            return -59;
                        var argp = SYSCALLS.get();
                        HEAP32[argp >> 2] = 0;
                        return 0
                    }
                case 21520:
                    {
                        if (!stream.tty)
                            return -59;
                        return -28
                    }
                case 21531:
                    {
                        var argp = SYSCALLS.get();
                        return FS.ioctl(stream, op, argp)
                    }
                case 21523:
                    {
                        if (!stream.tty)
                            return -59;
                        return 0
                    }
                case 21524:
                    {
                        if (!stream.tty)
                            return -59;
                        return 0
                    }
                default:
                    return -28
                }
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_ioctl.sig = "iiip";
        function ___syscall_lstat64(path, buf) {
            try {
                path = SYSCALLS.getStr(path);
                return SYSCALLS.doStat(FS.lstat, path, buf)
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_lstat64.sig = "ipp";
        function ___syscall_newfstatat(dirfd, path, buf, flags) {
            try {
                path = SYSCALLS.getStr(path);
                var nofollow = flags & 256;
                var allowEmpty = flags & 4096;
                flags = flags & ~6400;
                path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
                return SYSCALLS.doStat(nofollow ? FS.lstat : FS.stat, path, buf)
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_newfstatat.sig = "iippi";
        function ___syscall_openat(dirfd, path, flags, varargs) {
            SYSCALLS.varargs = varargs;
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);
                var mode = varargs ? SYSCALLS.get() : 0;
                return FS.open(path, flags, mode).fd
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_openat.sig = "iipip";
        function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);
                if (bufsize <= 0)
                    return -28;
                var ret = FS.readlink(path);
                var len = Math.min(bufsize, lengthBytesUTF8(ret));
                var endChar = HEAP8[buf + len];
                stringToUTF8(ret, buf, bufsize + 1);
                HEAP8[buf + len] = endChar;
                return len
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_readlinkat.sig = "vippp";
        function ___syscall_stat64(path, buf) {
            try {
                path = SYSCALLS.getStr(path);
                return SYSCALLS.doStat(FS.stat, path, buf)
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return -e.errno
            }
        }
        ___syscall_stat64.sig = "ipp";
        var ___table_base = new WebAssembly.Global({
            "value": "i32",
            "mutable": false
        },1);
        function __dlinit(main_dso_handle) {
            var dso = {
                refcount: Infinity,
                name: "__main__",
                module: Module["asm"],
                global: true
            };
            LDSO.loadedLibsByName[dso.name] = dso;
            LDSO.loadedLibsByHandle[main_dso_handle] = dso
        }
        var ENV = {};
        function allocateUTF8OnStack(str) {
            var size = lengthBytesUTF8(str) + 1;
            var ret = stackAlloc(size);
            stringToUTF8Array(str, HEAP8, ret, size);
            return ret
        }
        function dlSetError(msg) {
            withStackSave(function() {
                var cmsg = allocateUTF8OnStack(msg);
                ___dl_seterr(cmsg, 0)
            })
        }
        function dlopenInternal(handle, jsflags) {
            var filename = UTF8ToString(handle + 44);
            var flags = HEAP32[handle + 20 >> 2];
            filename = PATH.normalize(filename);
            var searchpaths = [];
            var isValidFile = filename=>{
                var target = FS.findObject(filename);
                return target && !target.isFolder && !target.isDevice
            }
            ;
            if (!isValidFile(filename)) {
                if (ENV["LD_LIBRARY_PATH"]) {
                    searchpaths = ENV["LD_LIBRARY_PATH"].split(":")
                }
                for (var ident in searchpaths) {
                    var searchfile = PATH.join2(searchpaths[ident], filename);
                    if (isValidFile(searchfile)) {
                        filename = searchfile;
                        break
                    }
                }
            }
            var combinedFlags = {
                global: Boolean(flags & 256),
                nodelete: Boolean(flags & 4096),
                loadAsync: jsflags.loadAsync,
                fs: jsflags.fs
            };
            if (jsflags.loadAsync) {
                return loadDynamicLibrary(filename, combinedFlags, handle)
            }
            try {
                return loadDynamicLibrary(filename, combinedFlags, handle)
            } catch (e) {
                dlSetError("Could not load dynamic lib: " + filename + "\n" + e);
                return 0
            }
        }
        function __dlopen_js(handle) {
            var jsflags = {
                loadAsync: false,
                fs: FS
            };
            return dlopenInternal(handle, jsflags)
        }
        __dlopen_js.sig = "pp";
        function __dlsym_js(handle, symbol) {
            symbol = UTF8ToString(symbol);
            var result;
            if (handle == 0) {
                result = resolveGlobalSymbol(symbol, true);
                if (!result) {
                    dlSetError('Tried to lookup unknown symbol "' + symbol + '" in dynamic lib: RTLD_DEFAULT');
                    return 0
                }
            } else {
                var lib = LDSO.loadedLibsByHandle[handle];
                if (!lib.module.hasOwnProperty(symbol)) {
                    dlSetError('Tried to lookup unknown symbol "' + symbol + '" in dynamic lib: ' + lib.name);
                    return 0
                }
                result = lib.module[symbol]
            }
            if (typeof result == "function") {
                result = addFunction(result, result.sig)
            }
            return result
        }
        __dlsym_js.sig = "ppp";
        function embindRepr(v) {
            if (v === null) {
                return "null"
            }
            var t = typeof v;
            if (t === "object" || t === "array" || t === "function") {
                return v.toString()
            } else {
                return "" + v
            }
        }
        function embind_init_charCodes() {
            var codes = new Array(256);
            for (var i = 0; i < 256; ++i) {
                codes[i] = String.fromCharCode(i)
            }
            embind_charCodes = codes
        }
        var embind_charCodes = undefined;
        function readLatin1String(ptr) {
            var ret = "";
            var c = ptr;
            while (HEAPU8[c]) {
                ret += embind_charCodes[HEAPU8[c++]]
            }
            return ret
        }
        var awaitingDependencies = {};
        var registeredTypes = {};
        var typeDependencies = {};
        var char_0 = 48;
        var char_9 = 57;
        function makeLegalFunctionName(name) {
            if (undefined === name) {
                return "_unknown"
            }
            name = name.replace(/[^a-zA-Z0-9_]/g, "$");
            var f = name.charCodeAt(0);
            if (f >= char_0 && f <= char_9) {
                return "_" + name
            }
            return name
        }
        function createNamedFunction(name, body) {
            name = makeLegalFunctionName(name);
            return new Function("body","return function " + name + "() {\n" + '    "use strict";' + "    return body.apply(this, arguments);\n" + "};\n")(body)
        }
        function extendError(baseErrorType, errorName) {
            var errorClass = createNamedFunction(errorName, function(message) {
                this.name = errorName;
                this.message = message;
                var stack = new Error(message).stack;
                if (stack !== undefined) {
                    this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "")
                }
            });
            errorClass.prototype = Object.create(baseErrorType.prototype);
            errorClass.prototype.constructor = errorClass;
            errorClass.prototype.toString = function() {
                if (this.message === undefined) {
                    return this.name
                } else {
                    return this.name + ": " + this.message
                }
            }
            ;
            return errorClass
        }
        var BindingError = undefined;
        function throwBindingError(message) {
            throw new BindingError(message)
        }
        var InternalError = undefined;
        function throwInternalError(message) {
            throw new InternalError(message)
        }
        function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
            myTypes.forEach(function(type) {
                typeDependencies[type] = dependentTypes
            });
            function onComplete(typeConverters) {
                var myTypeConverters = getTypeConverters(typeConverters);
                if (myTypeConverters.length !== myTypes.length) {
                    throwInternalError("Mismatched type converter count")
                }
                for (var i = 0; i < myTypes.length; ++i) {
                    registerType(myTypes[i], myTypeConverters[i])
                }
            }
            var typeConverters = new Array(dependentTypes.length);
            var unregisteredTypes = [];
            var registered = 0;
            dependentTypes.forEach((dt,i)=>{
                if (registeredTypes.hasOwnProperty(dt)) {
                    typeConverters[i] = registeredTypes[dt]
                } else {
                    unregisteredTypes.push(dt);
                    if (!awaitingDependencies.hasOwnProperty(dt)) {
                        awaitingDependencies[dt] = []
                    }
                    awaitingDependencies[dt].push(()=>{
                        typeConverters[i] = registeredTypes[dt];
                        ++registered;
                        if (registered === unregisteredTypes.length) {
                            onComplete(typeConverters)
                        }
                    }
                    )
                }
            }
            );
            if (0 === unregisteredTypes.length) {
                onComplete(typeConverters)
            }
        }
        function registerType(rawType, registeredInstance, options={}) {
            if (!("argPackAdvance"in registeredInstance)) {
                throw new TypeError("registerType registeredInstance requires argPackAdvance")
            }
            var name = registeredInstance.name;
            if (!rawType) {
                throwBindingError('type "' + name + '" must have a positive integer typeid pointer')
            }
            if (registeredTypes.hasOwnProperty(rawType)) {
                if (options.ignoreDuplicateRegistrations) {
                    return
                } else {
                    throwBindingError("Cannot register type '" + name + "' twice")
                }
            }
            registeredTypes[rawType] = registeredInstance;
            delete typeDependencies[rawType];
            if (awaitingDependencies.hasOwnProperty(rawType)) {
                var callbacks = awaitingDependencies[rawType];
                delete awaitingDependencies[rawType];
                callbacks.forEach(cb=>cb())
            }
        }
        function integerReadValueFromPointer(name, shift, signed) {
            switch (shift) {
            case 0:
                return signed ? function readS8FromPointer(pointer) {
                    return HEAP8[pointer]
                }
                : function readU8FromPointer(pointer) {
                    return HEAPU8[pointer]
                }
                ;
            case 1:
                return signed ? function readS16FromPointer(pointer) {
                    return HEAP16[pointer >> 1]
                }
                : function readU16FromPointer(pointer) {
                    return HEAPU16[pointer >> 1]
                }
                ;
            case 2:
                return signed ? function readS32FromPointer(pointer) {
                    return HEAP32[pointer >> 2]
                }
                : function readU32FromPointer(pointer) {
                    return HEAPU32[pointer >> 2]
                }
                ;
            case 3:
                return signed ? function readS64FromPointer(pointer) {
                    return HEAP64[pointer >> 3]
                }
                : function readU64FromPointer(pointer) {
                    return HEAPU64[pointer >> 3]
                }
                ;
            default:
                throw new TypeError("Unknown integer type: " + name)
            }
        }
        function __embind_register_bigint(primitiveType, name, size, minRange, maxRange) {
            name = readLatin1String(name);
            var shift = getShiftFromSize(size);
            var isUnsignedType = name.indexOf("u") != -1;
            if (isUnsignedType) {
                maxRange = (1n << 64n) - 1n
            }
            registerType(primitiveType, {
                name: name,
                "fromWireType": function(value) {
                    return value
                },
                "toWireType": function(destructors, value) {
                    if (typeof value != "bigint" && typeof value != "number") {
                        throw new TypeError('Cannot convert "' + embindRepr(value) + '" to ' + this.name)
                    }
                    if (value < minRange || value > maxRange) {
                        throw new TypeError('Passing a number "' + embindRepr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!")
                    }
                    return value
                },
                "argPackAdvance": 8,
                "readValueFromPointer": integerReadValueFromPointer(name, shift, !isUnsignedType),
                destructorFunction: null
            })
        }
        __embind_register_bigint.sig = "vpppjj";
        function getShiftFromSize(size) {
            switch (size) {
            case 1:
                return 0;
            case 2:
                return 1;
            case 4:
                return 2;
            case 8:
                return 3;
            default:
                throw new TypeError("Unknown type size: " + size)
            }
        }
        function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
            var shift = getShiftFromSize(size);
            name = readLatin1String(name);
            registerType(rawType, {
                name: name,
                "fromWireType": function(wt) {
                    return !!wt
                },
                "toWireType": function(destructors, o) {
                    return o ? trueValue : falseValue
                },
                "argPackAdvance": 8,
                "readValueFromPointer": function(pointer) {
                    var heap;
                    if (size === 1) {
                        heap = HEAP8
                    } else if (size === 2) {
                        heap = HEAP16
                    } else if (size === 4) {
                        heap = HEAP32
                    } else {
                        throw new TypeError("Unknown boolean type size: " + name)
                    }
                    return this["fromWireType"](heap[pointer >> shift])
                },
                destructorFunction: null
            })
        }
        __embind_register_bool.sig = "vpppii";
        function ClassHandle_isAliasOf(other) {
            if (!(this instanceof ClassHandle)) {
                return false
            }
            if (!(other instanceof ClassHandle)) {
                return false
            }
            var leftClass = this.$$.ptrType.registeredClass;
            var left = this.$$.ptr;
            var rightClass = other.$$.ptrType.registeredClass;
            var right = other.$$.ptr;
            while (leftClass.baseClass) {
                left = leftClass.upcast(left);
                leftClass = leftClass.baseClass
            }
            while (rightClass.baseClass) {
                right = rightClass.upcast(right);
                rightClass = rightClass.baseClass
            }
            return leftClass === rightClass && left === right
        }
        function shallowCopyInternalPointer(o) {
            return {
                count: o.count,
                deleteScheduled: o.deleteScheduled,
                preservePointerOnDelete: o.preservePointerOnDelete,
                ptr: o.ptr,
                ptrType: o.ptrType,
                smartPtr: o.smartPtr,
                smartPtrType: o.smartPtrType
            }
        }
        function throwInstanceAlreadyDeleted(obj) {
            function getInstanceTypeName(handle) {
                return handle.$$.ptrType.registeredClass.name
            }
            throwBindingError(getInstanceTypeName(obj) + " instance already deleted")
        }
        var finalizationRegistry = false;
        function detachFinalizer(handle) {}
        function runDestructor($$) {
            if ($$.smartPtr) {
                $$.smartPtrType.rawDestructor($$.smartPtr)
            } else {
                $$.ptrType.registeredClass.rawDestructor($$.ptr)
            }
        }
        function releaseClassHandle($$) {
            $$.count.value -= 1;
            var toDelete = 0 === $$.count.value;
            if (toDelete) {
                runDestructor($$)
            }
        }
        function downcastPointer(ptr, ptrClass, desiredClass) {
            if (ptrClass === desiredClass) {
                return ptr
            }
            if (undefined === desiredClass.baseClass) {
                return null
            }
            var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
            if (rv === null) {
                return null
            }
            return desiredClass.downcast(rv)
        }
        var registeredPointers = {};
        function getInheritedInstanceCount() {
            return Object.keys(registeredInstances).length
        }
        function getLiveInheritedInstances() {
            var rv = [];
            for (var k in registeredInstances) {
                if (registeredInstances.hasOwnProperty(k)) {
                    rv.push(registeredInstances[k])
                }
            }
            return rv
        }
        var deletionQueue = [];
        function flushPendingDeletes() {
            while (deletionQueue.length) {
                var obj = deletionQueue.pop();
                obj.$$.deleteScheduled = false;
                obj["delete"]()
            }
        }
        var delayFunction = undefined;
        function setDelayFunction(fn) {
            delayFunction = fn;
            if (deletionQueue.length && delayFunction) {
                delayFunction(flushPendingDeletes)
            }
        }
        function init_embind() {
            Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
            Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
            Module["flushPendingDeletes"] = flushPendingDeletes;
            Module["setDelayFunction"] = setDelayFunction
        }
        var registeredInstances = {};
        function getBasestPointer(class_, ptr) {
            if (ptr === undefined) {
                throwBindingError("ptr should not be undefined")
            }
            while (class_.baseClass) {
                ptr = class_.upcast(ptr);
                class_ = class_.baseClass
            }
            return ptr
        }
        function getInheritedInstance(class_, ptr) {
            ptr = getBasestPointer(class_, ptr);
            return registeredInstances[ptr]
        }
        function makeClassHandle(prototype, record) {
            if (!record.ptrType || !record.ptr) {
                throwInternalError("makeClassHandle requires ptr and ptrType")
            }
            var hasSmartPtrType = !!record.smartPtrType;
            var hasSmartPtr = !!record.smartPtr;
            if (hasSmartPtrType !== hasSmartPtr) {
                throwInternalError("Both smartPtrType and smartPtr must be specified")
            }
            record.count = {
                value: 1
            };
            return attachFinalizer(Object.create(prototype, {
                $$: {
                    value: record
                }
            }))
        }
        function RegisteredPointer_fromWireType(ptr) {
            var rawPointer = this.getPointee(ptr);
            if (!rawPointer) {
                this.destructor(ptr);
                return null
            }
            var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
            if (undefined !== registeredInstance) {
                if (0 === registeredInstance.$$.count.value) {
                    registeredInstance.$$.ptr = rawPointer;
                    registeredInstance.$$.smartPtr = ptr;
                    return registeredInstance["clone"]()
                } else {
                    var rv = registeredInstance["clone"]();
                    this.destructor(ptr);
                    return rv
                }
            }
            function makeDefaultHandle() {
                if (this.isSmartPointer) {
                    return makeClassHandle(this.registeredClass.instancePrototype, {
                        ptrType: this.pointeeType,
                        ptr: rawPointer,
                        smartPtrType: this,
                        smartPtr: ptr
                    })
                } else {
                    return makeClassHandle(this.registeredClass.instancePrototype, {
                        ptrType: this,
                        ptr: ptr
                    })
                }
            }
            var actualType = this.registeredClass.getActualType(rawPointer);
            var registeredPointerRecord = registeredPointers[actualType];
            if (!registeredPointerRecord) {
                return makeDefaultHandle.call(this)
            }
            var toType;
            if (this.isConst) {
                toType = registeredPointerRecord.constPointerType
            } else {
                toType = registeredPointerRecord.pointerType
            }
            var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
            if (dp === null) {
                return makeDefaultHandle.call(this)
            }
            if (this.isSmartPointer) {
                return makeClassHandle(toType.registeredClass.instancePrototype, {
                    ptrType: toType,
                    ptr: dp,
                    smartPtrType: this,
                    smartPtr: ptr
                })
            } else {
                return makeClassHandle(toType.registeredClass.instancePrototype, {
                    ptrType: toType,
                    ptr: dp
                })
            }
        }
        function attachFinalizer(handle) {
            if ("undefined" === typeof FinalizationRegistry) {
                attachFinalizer = handle=>handle;
                return handle
            }
            finalizationRegistry = new FinalizationRegistry(info=>{
                releaseClassHandle(info.$$)
            }
            );
            attachFinalizer = handle=>{
                var $$ = handle.$$;
                var hasSmartPtr = !!$$.smartPtr;
                if (hasSmartPtr) {
                    var info = {
                        $$: $$
                    };
                    finalizationRegistry.register(handle, info, handle)
                }
                return handle
            }
            ;
            detachFinalizer = handle=>finalizationRegistry.unregister(handle);
            return attachFinalizer(handle)
        }
        function ClassHandle_clone() {
            if (!this.$$.ptr) {
                throwInstanceAlreadyDeleted(this)
            }
            if (this.$$.preservePointerOnDelete) {
                this.$$.count.value += 1;
                return this
            } else {
                var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), {
                    $$: {
                        value: shallowCopyInternalPointer(this.$$)
                    }
                }));
                clone.$$.count.value += 1;
                clone.$$.deleteScheduled = false;
                return clone
            }
        }
        function ClassHandle_delete() {
            if (!this.$$.ptr) {
                throwInstanceAlreadyDeleted(this)
            }
            if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
                throwBindingError("Object already scheduled for deletion")
            }
            detachFinalizer(this);
            releaseClassHandle(this.$$);
            if (!this.$$.preservePointerOnDelete) {
                this.$$.smartPtr = undefined;
                this.$$.ptr = undefined
            }
        }
        function ClassHandle_isDeleted() {
            return !this.$$.ptr
        }
        function ClassHandle_deleteLater() {
            if (!this.$$.ptr) {
                throwInstanceAlreadyDeleted(this)
            }
            if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
                throwBindingError("Object already scheduled for deletion")
            }
            deletionQueue.push(this);
            if (deletionQueue.length === 1 && delayFunction) {
                delayFunction(flushPendingDeletes)
            }
            this.$$.deleteScheduled = true;
            return this
        }
        function init_ClassHandle() {
            ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
            ClassHandle.prototype["clone"] = ClassHandle_clone;
            ClassHandle.prototype["delete"] = ClassHandle_delete;
            ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
            ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater
        }
        function ClassHandle() {}
        function ensureOverloadTable(proto, methodName, humanName) {
            if (undefined === proto[methodName].overloadTable) {
                var prevFunc = proto[methodName];
                proto[methodName] = function() {
                    if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                        throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!")
                    }
                    return proto[methodName].overloadTable[arguments.length].apply(this, arguments)
                }
                ;
                proto[methodName].overloadTable = [];
                proto[methodName].overloadTable[prevFunc.argCount] = prevFunc
            }
        }
        function exposePublicSymbol(name, value, numArguments) {
            if (Module.hasOwnProperty(name)) {
                if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
                    throwBindingError("Cannot register public name '" + name + "' twice")
                }
                ensureOverloadTable(Module, name, name);
                if (Module.hasOwnProperty(numArguments)) {
                    throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!")
                }
                Module[name].overloadTable[numArguments] = value
            } else {
                Module[name] = value;
                if (undefined !== numArguments) {
                    Module[name].numArguments = numArguments
                }
            }
        }
        function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
            this.name = name;
            this.constructor = constructor;
            this.instancePrototype = instancePrototype;
            this.rawDestructor = rawDestructor;
            this.baseClass = baseClass;
            this.getActualType = getActualType;
            this.upcast = upcast;
            this.downcast = downcast;
            this.pureVirtualFunctions = []
        }
        function upcastPointer(ptr, ptrClass, desiredClass) {
            while (ptrClass !== desiredClass) {
                if (!ptrClass.upcast) {
                    throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name)
                }
                ptr = ptrClass.upcast(ptr);
                ptrClass = ptrClass.baseClass
            }
            return ptr
        }
        function constNoSmartPtrRawPointerToWireType(destructors, handle) {
            if (handle === null) {
                if (this.isReference) {
                    throwBindingError("null is not a valid " + this.name)
                }
                return 0
            }
            if (!handle.$$) {
                throwBindingError('Cannot pass "' + embindRepr(handle) + '" as a ' + this.name)
            }
            if (!handle.$$.ptr) {
                throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
            }
            var handleClass = handle.$$.ptrType.registeredClass;
            var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
            return ptr
        }
        function genericPointerToWireType(destructors, handle) {
            var ptr;
            if (handle === null) {
                if (this.isReference) {
                    throwBindingError("null is not a valid " + this.name)
                }
                if (this.isSmartPointer) {
                    ptr = this.rawConstructor();
                    if (destructors !== null) {
                        destructors.push(this.rawDestructor, ptr)
                    }
                    return ptr
                } else {
                    return 0
                }
            }
            if (!handle.$$) {
                throwBindingError('Cannot pass "' + embindRepr(handle) + '" as a ' + this.name)
            }
            if (!handle.$$.ptr) {
                throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
            }
            if (!this.isConst && handle.$$.ptrType.isConst) {
                throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name)
            }
            var handleClass = handle.$$.ptrType.registeredClass;
            ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
            if (this.isSmartPointer) {
                if (undefined === handle.$$.smartPtr) {
                    throwBindingError("Passing raw pointer to smart pointer is illegal")
                }
                switch (this.sharingPolicy) {
                case 0:
                    if (handle.$$.smartPtrType === this) {
                        ptr = handle.$$.smartPtr
                    } else {
                        throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name)
                    }
                    break;
                case 1:
                    ptr = handle.$$.smartPtr;
                    break;
                case 2:
                    if (handle.$$.smartPtrType === this) {
                        ptr = handle.$$.smartPtr
                    } else {
                        var clonedHandle = handle["clone"]();
                        ptr = this.rawShare(ptr, Emval.toHandle(function() {
                            clonedHandle["delete"]()
                        }));
                        if (destructors !== null) {
                            destructors.push(this.rawDestructor, ptr)
                        }
                    }
                    break;
                default:
                    throwBindingError("Unsupporting sharing policy")
                }
            }
            return ptr
        }
        function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
            if (handle === null) {
                if (this.isReference) {
                    throwBindingError("null is not a valid " + this.name)
                }
                return 0
            }
            if (!handle.$$) {
                throwBindingError('Cannot pass "' + embindRepr(handle) + '" as a ' + this.name)
            }
            if (!handle.$$.ptr) {
                throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
            }
            if (handle.$$.ptrType.isConst) {
                throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name)
            }
            var handleClass = handle.$$.ptrType.registeredClass;
            var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
            return ptr
        }
        function simpleReadValueFromPointer(pointer) {
            return this["fromWireType"](HEAP32[pointer >> 2])
        }
        function RegisteredPointer_getPointee(ptr) {
            if (this.rawGetPointee) {
                ptr = this.rawGetPointee(ptr)
            }
            return ptr
        }
        function RegisteredPointer_destructor(ptr) {
            if (this.rawDestructor) {
                this.rawDestructor(ptr)
            }
        }
        function RegisteredPointer_deleteObject(handle) {
            if (handle !== null) {
                handle["delete"]()
            }
        }
        function init_RegisteredPointer() {
            RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
            RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
            RegisteredPointer.prototype["argPackAdvance"] = 8;
            RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
            RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
            RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType
        }
        function RegisteredPointer(name, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
            this.name = name;
            this.registeredClass = registeredClass;
            this.isReference = isReference;
            this.isConst = isConst;
            this.isSmartPointer = isSmartPointer;
            this.pointeeType = pointeeType;
            this.sharingPolicy = sharingPolicy;
            this.rawGetPointee = rawGetPointee;
            this.rawConstructor = rawConstructor;
            this.rawShare = rawShare;
            this.rawDestructor = rawDestructor;
            if (!isSmartPointer && registeredClass.baseClass === undefined) {
                if (isConst) {
                    this["toWireType"] = constNoSmartPtrRawPointerToWireType;
                    this.destructorFunction = null
                } else {
                    this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
                    this.destructorFunction = null
                }
            } else {
                this["toWireType"] = genericPointerToWireType
            }
        }
        function replacePublicSymbol(name, value, numArguments) {
            if (!Module.hasOwnProperty(name)) {
                throwInternalError("Replacing nonexistant public symbol")
            }
            if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
                Module[name].overloadTable[numArguments] = value
            } else {
                Module[name] = value;
                Module[name].argCount = numArguments
            }
        }
        function embind__requireFunction(signature, rawFunction) {
            signature = readLatin1String(signature);
            function makeDynCaller() {
                return getWasmTableEntry(rawFunction)
            }
            var fp = makeDynCaller();
            if (typeof fp != "function") {
                throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction)
            }
            return fp
        }
        var UnboundTypeError = undefined;
        function getTypeName(type) {
            var ptr = ___getTypeName(type);
            var rv = readLatin1String(ptr);
            _free(ptr);
            return rv
        }
        function throwUnboundTypeError(message, types) {
            var unboundTypes = [];
            var seen = {};
            function visit(type) {
                if (seen[type]) {
                    return
                }
                if (registeredTypes[type]) {
                    return
                }
                if (typeDependencies[type]) {
                    typeDependencies[type].forEach(visit);
                    return
                }
                unboundTypes.push(type);
                seen[type] = true
            }
            types.forEach(visit);
            throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]))
        }
        function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
            name = readLatin1String(name);
            getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
            if (upcast) {
                upcast = embind__requireFunction(upcastSignature, upcast)
            }
            if (downcast) {
                downcast = embind__requireFunction(downcastSignature, downcast)
            }
            rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
            var legalFunctionName = makeLegalFunctionName(name);
            exposePublicSymbol(legalFunctionName, function() {
                throwUnboundTypeError("Cannot construct " + name + " due to unbound types", [baseClassRawType])
            });
            whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function(base) {
                base = base[0];
                var baseClass;
                var basePrototype;
                if (baseClassRawType) {
                    baseClass = base.registeredClass;
                    basePrototype = baseClass.instancePrototype
                } else {
                    basePrototype = ClassHandle.prototype
                }
                var constructor = createNamedFunction(legalFunctionName, function() {
                    if (Object.getPrototypeOf(this) !== instancePrototype) {
                        throw new BindingError("Use 'new' to construct " + name)
                    }
                    if (undefined === registeredClass.constructor_body) {
                        throw new BindingError(name + " has no accessible constructor")
                    }
                    var body = registeredClass.constructor_body[arguments.length];
                    if (undefined === body) {
                        throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!")
                    }
                    return body.apply(this, arguments)
                });
                var instancePrototype = Object.create(basePrototype, {
                    constructor: {
                        value: constructor
                    }
                });
                constructor.prototype = instancePrototype;
                var registeredClass = new RegisteredClass(name,constructor,instancePrototype,rawDestructor,baseClass,getActualType,upcast,downcast);
                var referenceConverter = new RegisteredPointer(name,registeredClass,true,false,false);
                var pointerConverter = new RegisteredPointer(name + "*",registeredClass,false,false,false);
                var constPointerConverter = new RegisteredPointer(name + " const*",registeredClass,false,true,false);
                registeredPointers[rawType] = {
                    pointerType: pointerConverter,
                    constPointerType: constPointerConverter
                };
                replacePublicSymbol(legalFunctionName, constructor);
                return [referenceConverter, pointerConverter, constPointerConverter]
            })
        }
        __embind_register_class.sig = "vppppppppppppp";
        function heap32VectorToArray(count, firstElement) {
            var array = [];
            for (var i = 0; i < count; i++) {
                array.push(HEAPU32[firstElement + i * 4 >> 2])
            }
            return array
        }
        function runDestructors(destructors) {
            while (destructors.length) {
                var ptr = destructors.pop();
                var del = destructors.pop();
                del(ptr)
            }
        }
        function new_(constructor, argumentList) {
            if (!(constructor instanceof Function)) {
                throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function")
            }
            var dummy = createNamedFunction(constructor.name || "unknownFunctionName", function() {});
            dummy.prototype = constructor.prototype;
            var obj = new dummy;
            var r = constructor.apply(obj, argumentList);
            return r instanceof Object ? r : obj
        }
        function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
            var argCount = argTypes.length;
            if (argCount < 2) {
                throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!")
            }
            var isClassMethodFunc = argTypes[1] !== null && classType !== null;
            var needsDestructorStack = false;
            for (var i = 1; i < argTypes.length; ++i) {
                if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
                    needsDestructorStack = true;
                    break
                }
            }
            var returns = argTypes[0].name !== "void";
            var argsList = "";
            var argsListWired = "";
            for (var i = 0; i < argCount - 2; ++i) {
                argsList += (i !== 0 ? ", " : "") + "arg" + i;
                argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired"
            }
            var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\n" + "if (arguments.length !== " + (argCount - 2) + ") {\n" + "throwBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n" + "}\n";
            if (needsDestructorStack) {
                invokerFnBody += "var destructors = [];\n"
            }
            var dtorStack = needsDestructorStack ? "destructors" : "null";
            var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
            var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
            if (isClassMethodFunc) {
                invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n"
            }
            for (var i = 0; i < argCount - 2; ++i) {
                invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
                args1.push("argType" + i);
                args2.push(argTypes[i + 2])
            }
            if (isClassMethodFunc) {
                argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired
            }
            invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";
            if (needsDestructorStack) {
                invokerFnBody += "runDestructors(destructors);\n"
            } else {
                for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
                    var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
                    if (argTypes[i].destructorFunction !== null) {
                        invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
                        args1.push(paramName + "_dtor");
                        args2.push(argTypes[i].destructorFunction)
                    }
                }
            }
            if (returns) {
                invokerFnBody += "var ret = retType.fromWireType(rv);\n" + "return ret;\n"
            } else {}
            invokerFnBody += "}\n";
            args1.push(invokerFnBody);
            var invokerFunction = new_(Function, args1).apply(null, args2);
            return invokerFunction
        }
        function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
            assert(argCount > 0);
            var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
            invoker = embind__requireFunction(invokerSignature, invoker);
            whenDependentTypesAreResolved([], [rawClassType], function(classType) {
                classType = classType[0];
                var humanName = "constructor " + classType.name;
                if (undefined === classType.registeredClass.constructor_body) {
                    classType.registeredClass.constructor_body = []
                }
                if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
                    throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!")
                }
                classType.registeredClass.constructor_body[argCount - 1] = ()=>{
                    throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes)
                }
                ;
                whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
                    argTypes.splice(1, 0, null);
                    classType.registeredClass.constructor_body[argCount - 1] = craftInvokerFunction(humanName, argTypes, null, invoker, rawConstructor);
                    return []
                });
                return []
            })
        }
        __embind_register_class_constructor.sig = "vpipppp";
        function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
            var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
            methodName = readLatin1String(methodName);
            rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
            whenDependentTypesAreResolved([], [rawClassType], function(classType) {
                classType = classType[0];
                var humanName = classType.name + "." + methodName;
                if (methodName.startsWith("@@")) {
                    methodName = Symbol[methodName.substring(2)]
                }
                if (isPureVirtual) {
                    classType.registeredClass.pureVirtualFunctions.push(methodName)
                }
                function unboundTypesHandler() {
                    throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes)
                }
                var proto = classType.registeredClass.instancePrototype;
                var method = proto[methodName];
                if (undefined === method || undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
                    unboundTypesHandler.argCount = argCount - 2;
                    unboundTypesHandler.className = classType.name;
                    proto[methodName] = unboundTypesHandler
                } else {
                    ensureOverloadTable(proto, methodName, humanName);
                    proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler
                }
                whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
                    var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
                    if (undefined === proto[methodName].overloadTable) {
                        memberFunction.argCount = argCount - 2;
                        proto[methodName] = memberFunction
                    } else {
                        proto[methodName].overloadTable[argCount - 2] = memberFunction
                    }
                    return []
                });
                return []
            })
        }
        __embind_register_class_function.sig = "vppippppi";
        function validateThis(this_, classType, humanName) {
            if (!(this_ instanceof Object)) {
                throwBindingError(humanName + ' with invalid "this": ' + this_)
            }
            if (!(this_ instanceof classType.registeredClass.constructor)) {
                throwBindingError(humanName + ' incompatible with "this" of type ' + this_.constructor.name)
            }
            if (!this_.$$.ptr) {
                throwBindingError("cannot call emscripten binding method " + humanName + " on deleted object")
            }
            return upcastPointer(this_.$$.ptr, this_.$$.ptrType.registeredClass, classType.registeredClass)
        }
        function __embind_register_class_property(classType, fieldName, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
            fieldName = readLatin1String(fieldName);
            getter = embind__requireFunction(getterSignature, getter);
            whenDependentTypesAreResolved([], [classType], function(classType) {
                classType = classType[0];
                var humanName = classType.name + "." + fieldName;
                var desc = {
                    get: function() {
                        throwUnboundTypeError("Cannot access " + humanName + " due to unbound types", [getterReturnType, setterArgumentType])
                    },
                    enumerable: true,
                    configurable: true
                };
                if (setter) {
                    desc.set = ()=>{
                        throwUnboundTypeError("Cannot access " + humanName + " due to unbound types", [getterReturnType, setterArgumentType])
                    }
                } else {
                    desc.set = v=>{
                        throwBindingError(humanName + " is a read-only property")
                    }
                }
                Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
                whenDependentTypesAreResolved([], setter ? [getterReturnType, setterArgumentType] : [getterReturnType], function(types) {
                    var getterReturnType = types[0];
                    var desc = {
                        get: function() {
                            var ptr = validateThis(this, classType, humanName + " getter");
                            return getterReturnType["fromWireType"](getter(getterContext, ptr))
                        },
                        enumerable: true
                    };
                    if (setter) {
                        setter = embind__requireFunction(setterSignature, setter);
                        var setterArgumentType = types[1];
                        desc.set = function(v) {
                            var ptr = validateThis(this, classType, humanName + " setter");
                            var destructors = [];
                            setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, v));
                            runDestructors(destructors)
                        }
                    }
                    Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
                    return []
                });
                return []
            })
        }
        __embind_register_class_property.sig = "vpppppppppp";
        function __embind_register_constant(name, type, value) {
            name = readLatin1String(name);
            whenDependentTypesAreResolved([], [type], function(type) {
                type = type[0];
                Module[name] = type["fromWireType"](value);
                return []
            })
        }
        __embind_register_constant.sig = "vppd";
        var emval_free_list = [];
        var emval_handle_array = [{}, {
            value: undefined
        }, {
            value: null
        }, {
            value: true
        }, {
            value: false
        }];
        function __emval_decref(handle) {
            if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
                emval_handle_array[handle] = undefined;
                emval_free_list.push(handle)
            }
        }
        __emval_decref.sig = "vp";
        function count_emval_handles() {
            var count = 0;
            for (var i = 5; i < emval_handle_array.length; ++i) {
                if (emval_handle_array[i] !== undefined) {
                    ++count
                }
            }
            return count
        }
        function get_first_emval() {
            for (var i = 5; i < emval_handle_array.length; ++i) {
                if (emval_handle_array[i] !== undefined) {
                    return emval_handle_array[i]
                }
            }
            return null
        }
        function init_emval() {
            Module["count_emval_handles"] = count_emval_handles;
            Module["get_first_emval"] = get_first_emval
        }
        var Emval = {
            toValue: handle=>{
                if (!handle) {
                    throwBindingError("Cannot use deleted val. handle = " + handle)
                }
                return emval_handle_array[handle].value
            }
            ,
            toHandle: value=>{
                switch (value) {
                case undefined:
                    return 1;
                case null:
                    return 2;
                case true:
                    return 3;
                case false:
                    return 4;
                default:
                    {
                        var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
                        emval_handle_array[handle] = {
                            refcount: 1,
                            value: value
                        };
                        return handle
                    }
                }
            }
        };
        function __embind_register_emval(rawType, name) {
            name = readLatin1String(name);
            registerType(rawType, {
                name: name,
                "fromWireType": function(handle) {
                    var rv = Emval.toValue(handle);
                    __emval_decref(handle);
                    return rv
                },
                "toWireType": function(destructors, value) {
                    return Emval.toHandle(value)
                },
                "argPackAdvance": 8,
                "readValueFromPointer": simpleReadValueFromPointer,
                destructorFunction: null
            })
        }
        __embind_register_emval.sig = "vpp";
        function enumReadValueFromPointer(name, shift, signed) {
            switch (shift) {
            case 0:
                return function(pointer) {
                    var heap = signed ? HEAP8 : HEAPU8;
                    return this["fromWireType"](heap[pointer])
                }
                ;
            case 1:
                return function(pointer) {
                    var heap = signed ? HEAP16 : HEAPU16;
                    return this["fromWireType"](heap[pointer >> 1])
                }
                ;
            case 2:
                return function(pointer) {
                    var heap = signed ? HEAP32 : HEAPU32;
                    return this["fromWireType"](heap[pointer >> 2])
                }
                ;
            default:
                throw new TypeError("Unknown integer type: " + name)
            }
        }
        function __embind_register_enum(rawType, name, size, isSigned) {
            var shift = getShiftFromSize(size);
            name = readLatin1String(name);
            function ctor() {}
            ctor.values = {};
            registerType(rawType, {
                name: name,
                constructor: ctor,
                "fromWireType": function(c) {
                    return this.constructor.values[c]
                },
                "toWireType": function(destructors, c) {
                    return c.value
                },
                "argPackAdvance": 8,
                "readValueFromPointer": enumReadValueFromPointer(name, shift, isSigned),
                destructorFunction: null
            });
            exposePublicSymbol(name, ctor)
        }
        __embind_register_enum.sig = "vpppi";
        function requireRegisteredType(rawType, humanName) {
            var impl = registeredTypes[rawType];
            if (undefined === impl) {
                throwBindingError(humanName + " has unknown type " + getTypeName(rawType))
            }
            return impl
        }
        function __embind_register_enum_value(rawEnumType, name, enumValue) {
            var enumType = requireRegisteredType(rawEnumType, "enum");
            name = readLatin1String(name);
            var Enum = enumType.constructor;
            var Value = Object.create(enumType.constructor.prototype, {
                value: {
                    value: enumValue
                },
                constructor: {
                    value: createNamedFunction(enumType.name + "_" + name, function() {})
                }
            });
            Enum.values[enumValue] = Value;
            Enum[name] = Value
        }
        __embind_register_enum_value.sig = "vppi";
        function floatReadValueFromPointer(name, shift) {
            switch (shift) {
            case 2:
                return function(pointer) {
                    return this["fromWireType"](HEAPF32[pointer >> 2])
                }
                ;
            case 3:
                return function(pointer) {
                    return this["fromWireType"](HEAPF64[pointer >> 3])
                }
                ;
            default:
                throw new TypeError("Unknown float type: " + name)
            }
        }
        function __embind_register_float(rawType, name, size) {
            var shift = getShiftFromSize(size);
            name = readLatin1String(name);
            registerType(rawType, {
                name: name,
                "fromWireType": function(value) {
                    return value
                },
                "toWireType": function(destructors, value) {
                    return value
                },
                "argPackAdvance": 8,
                "readValueFromPointer": floatReadValueFromPointer(name, shift),
                destructorFunction: null
            })
        }
        __embind_register_float.sig = "vppp";
        function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
            var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
            name = readLatin1String(name);
            rawInvoker = embind__requireFunction(signature, rawInvoker);
            exposePublicSymbol(name, function() {
                throwUnboundTypeError("Cannot call " + name + " due to unbound types", argTypes)
            }, argCount - 1);
            whenDependentTypesAreResolved([], argTypes, function(argTypes) {
                var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
                replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
                return []
            })
        }
        __embind_register_function.sig = "vpipppp";
        function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
            name = readLatin1String(name);
            if (maxRange === -1) {
                maxRange = 4294967295
            }
            var shift = getShiftFromSize(size);
            var fromWireType = value=>value;
            if (minRange === 0) {
                var bitshift = 32 - 8 * size;
                fromWireType = value=>value << bitshift >>> bitshift
            }
            var isUnsignedType = name.includes("unsigned");
            var checkAssertions = (value,toTypeName)=>{}
            ;
            var toWireType;
            if (isUnsignedType) {
                toWireType = function(destructors, value) {
                    checkAssertions(value, this.name);
                    return value >>> 0
                }
            } else {
                toWireType = function(destructors, value) {
                    checkAssertions(value, this.name);
                    return value
                }
            }
            registerType(primitiveType, {
                name: name,
                "fromWireType": fromWireType,
                "toWireType": toWireType,
                "argPackAdvance": 8,
                "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0),
                destructorFunction: null
            })
        }
        __embind_register_integer.sig = "vpppii";
        function __embind_register_memory_view(rawType, dataTypeIndex, name) {
            var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array];
            var TA = typeMapping[dataTypeIndex];
            function decodeMemoryView(handle) {
                handle = handle >> 2;
                var heap = HEAPU32;
                var size = heap[handle];
                var data = heap[handle + 1];
                return new TA(buffer,data,size)
            }
            name = readLatin1String(name);
            registerType(rawType, {
                name: name,
                "fromWireType": decodeMemoryView,
                "argPackAdvance": 8,
                "readValueFromPointer": decodeMemoryView
            }, {
                ignoreDuplicateRegistrations: true
            })
        }
        __embind_register_memory_view.sig = "vpip";
        function __embind_register_std_string(rawType, name) {
            name = readLatin1String(name);
            var stdStringIsUTF8 = name === "std::string";
            registerType(rawType, {
                name: name,
                "fromWireType": function(value) {
                    var length = HEAPU32[value >> 2];
                    var payload = value + 4;
                    var str;
                    if (stdStringIsUTF8) {
                        var decodeStartPtr = payload;
                        for (var i = 0; i <= length; ++i) {
                            var currentBytePtr = payload + i;
                            if (i == length || HEAPU8[currentBytePtr] == 0) {
                                var maxRead = currentBytePtr - decodeStartPtr;
                                var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                                if (str === undefined) {
                                    str = stringSegment
                                } else {
                                    str += String.fromCharCode(0);
                                    str += stringSegment
                                }
                                decodeStartPtr = currentBytePtr + 1
                            }
                        }
                    } else {
                        var a = new Array(length);
                        for (var i = 0; i < length; ++i) {
                            a[i] = String.fromCharCode(HEAPU8[payload + i])
                        }
                        str = a.join("")
                    }
                    _free(value);
                    return str
                },
                "toWireType": function(destructors, value) {
                    if (value instanceof ArrayBuffer) {
                        value = new Uint8Array(value)
                    }
                    var length;
                    var valueIsOfTypeString = typeof value == "string";
                    if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                        throwBindingError("Cannot pass non-string to std::string")
                    }
                    if (stdStringIsUTF8 && valueIsOfTypeString) {
                        length = lengthBytesUTF8(value)
                    } else {
                        length = value.length
                    }
                    var base = _malloc(4 + length + 1);
                    var ptr = base + 4;
                    HEAPU32[base >> 2] = length;
                    if (stdStringIsUTF8 && valueIsOfTypeString) {
                        stringToUTF8(value, ptr, length + 1)
                    } else {
                        if (valueIsOfTypeString) {
                            for (var i = 0; i < length; ++i) {
                                var charCode = value.charCodeAt(i);
                                if (charCode > 255) {
                                    _free(ptr);
                                    throwBindingError("String has UTF-16 code units that do not fit in 8 bits")
                                }
                                HEAPU8[ptr + i] = charCode
                            }
                        } else {
                            for (var i = 0; i < length; ++i) {
                                HEAPU8[ptr + i] = value[i]
                            }
                        }
                    }
                    if (destructors !== null) {
                        destructors.push(_free, base)
                    }
                    return base
                },
                "argPackAdvance": 8,
                "readValueFromPointer": simpleReadValueFromPointer,
                destructorFunction: function(ptr) {
                    _free(ptr)
                }
            })
        }
        __embind_register_std_string.sig = "vpp";
        var UTF16Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf-16le") : undefined;
        function UTF16ToString(ptr, maxBytesToRead) {
            var endPtr = ptr;
            var idx = endPtr >> 1;
            var maxIdx = idx + maxBytesToRead / 2;
            while (!(idx >= maxIdx) && HEAPU16[idx])
                ++idx;
            endPtr = idx << 1;
            if (endPtr - ptr > 32 && UTF16Decoder)
                return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
            var str = "";
            for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
                var codeUnit = HEAP16[ptr + i * 2 >> 1];
                if (codeUnit == 0)
                    break;
                str += String.fromCharCode(codeUnit)
            }
            return str
        }
        function stringToUTF16(str, outPtr, maxBytesToWrite) {
            if (maxBytesToWrite === undefined) {
                maxBytesToWrite = 2147483647
            }
            if (maxBytesToWrite < 2)
                return 0;
            maxBytesToWrite -= 2;
            var startPtr = outPtr;
            var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
            for (var i = 0; i < numCharsToWrite; ++i) {
                var codeUnit = str.charCodeAt(i);
                HEAP16[outPtr >> 1] = codeUnit;
                outPtr += 2
            }
            HEAP16[outPtr >> 1] = 0;
            return outPtr - startPtr
        }
        function lengthBytesUTF16(str) {
            return str.length * 2
        }
        function UTF32ToString(ptr, maxBytesToRead) {
            var i = 0;
            var str = "";
            while (!(i >= maxBytesToRead / 4)) {
                var utf32 = HEAP32[ptr + i * 4 >> 2];
                if (utf32 == 0)
                    break;
                ++i;
                if (utf32 >= 65536) {
                    var ch = utf32 - 65536;
                    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
                } else {
                    str += String.fromCharCode(utf32)
                }
            }
            return str
        }
        function stringToUTF32(str, outPtr, maxBytesToWrite) {
            if (maxBytesToWrite === undefined) {
                maxBytesToWrite = 2147483647
            }
            if (maxBytesToWrite < 4)
                return 0;
            var startPtr = outPtr;
            var endPtr = startPtr + maxBytesToWrite - 4;
            for (var i = 0; i < str.length; ++i) {
                var codeUnit = str.charCodeAt(i);
                if (codeUnit >= 55296 && codeUnit <= 57343) {
                    var trailSurrogate = str.charCodeAt(++i);
                    codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023
                }
                HEAP32[outPtr >> 2] = codeUnit;
                outPtr += 4;
                if (outPtr + 4 > endPtr)
                    break
            }
            HEAP32[outPtr >> 2] = 0;
            return outPtr - startPtr
        }
        function lengthBytesUTF32(str) {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
                var codeUnit = str.charCodeAt(i);
                if (codeUnit >= 55296 && codeUnit <= 57343)
                    ++i;
                len += 4
            }
            return len
        }
        function __embind_register_std_wstring(rawType, charSize, name) {
            name = readLatin1String(name);
            var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
            if (charSize === 2) {
                decodeString = UTF16ToString;
                encodeString = stringToUTF16;
                lengthBytesUTF = lengthBytesUTF16;
                getHeap = ()=>HEAPU16;
                shift = 1
            } else if (charSize === 4) {
                decodeString = UTF32ToString;
                encodeString = stringToUTF32;
                lengthBytesUTF = lengthBytesUTF32;
                getHeap = ()=>HEAPU32;
                shift = 2
            }
            registerType(rawType, {
                name: name,
                "fromWireType": function(value) {
                    var length = HEAPU32[value >> 2];
                    var HEAP = getHeap();
                    var str;
                    var decodeStartPtr = value + 4;
                    for (var i = 0; i <= length; ++i) {
                        var currentBytePtr = value + 4 + i * charSize;
                        if (i == length || HEAP[currentBytePtr >> shift] == 0) {
                            var maxReadBytes = currentBytePtr - decodeStartPtr;
                            var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
                            if (str === undefined) {
                                str = stringSegment
                            } else {
                                str += String.fromCharCode(0);
                                str += stringSegment
                            }
                            decodeStartPtr = currentBytePtr + charSize
                        }
                    }
                    _free(value);
                    return str
                },
                "toWireType": function(destructors, value) {
                    if (!(typeof value == "string")) {
                        throwBindingError("Cannot pass non-string to C++ string type " + name)
                    }
                    var length = lengthBytesUTF(value);
                    var ptr = _malloc(4 + length + charSize);
                    HEAPU32[ptr >> 2] = length >> shift;
                    encodeString(value, ptr + 4, length + charSize);
                    if (destructors !== null) {
                        destructors.push(_free, ptr)
                    }
                    return ptr
                },
                "argPackAdvance": 8,
                "readValueFromPointer": simpleReadValueFromPointer,
                destructorFunction: function(ptr) {
                    _free(ptr)
                }
            })
        }
        __embind_register_std_wstring.sig = "vppp";
        function __embind_register_void(rawType, name) {
            name = readLatin1String(name);
            registerType(rawType, {
                isVoid: true,
                name: name,
                "argPackAdvance": 0,
                "fromWireType": function() {
                    return undefined
                },
                "toWireType": function(destructors, o) {
                    return undefined
                }
            })
        }
        __embind_register_void.sig = "vpp";
        var nowIsMonotonic = true;
        function __emscripten_get_now_is_monotonic() {
            return nowIsMonotonic
        }
        __emscripten_get_now_is_monotonic.sig = "i";
        function __emval_as(handle, returnType, destructorsRef) {
            handle = Emval.toValue(handle);
            returnType = requireRegisteredType(returnType, "emval::as");
            var destructors = [];
            var rd = Emval.toHandle(destructors);
            HEAPU32[destructorsRef >> 2] = rd;
            return returnType["toWireType"](destructors, handle)
        }
        __emval_as.sig = "dppp";
        function __emval_as_uint64(handle, returnType, destructorsRef) {
            handle = Emval.toValue(handle);
            returnType = requireRegisteredType(returnType, "emval::as");
            return returnType["toWireType"](null, handle)
        }
        __emval_as_uint64.sig = "dppp";
        function __emval_equals(first, second) {
            first = Emval.toValue(first);
            second = Emval.toValue(second);
            return first == second
        }
        __emval_equals.sig = "ipp";
        function __emval_get_property(handle, key) {
            handle = Emval.toValue(handle);
            key = Emval.toValue(key);
            return Emval.toHandle(handle[key])
        }
        __emval_get_property.sig = "ppp";
        function __emval_incref(handle) {
            if (handle > 4) {
                emval_handle_array[handle].refcount += 1
            }
        }
        __emval_incref.sig = "vp";
        function __emval_new_array() {
            return Emval.toHandle([])
        }
        __emval_new_array.sig = "p";
        var emval_symbols = {};
        function getStringOrSymbol(address) {
            var symbol = emval_symbols[address];
            if (symbol === undefined) {
                return readLatin1String(address)
            }
            return symbol
        }
        function __emval_new_cstring(v) {
            return Emval.toHandle(getStringOrSymbol(v))
        }
        __emval_new_cstring.sig = "pp";
        function __emval_new_object() {
            return Emval.toHandle({})
        }
        __emval_new_object.sig = "p";
        function __emval_run_destructors(handle) {
            var destructors = Emval.toValue(handle);
            runDestructors(destructors);
            __emval_decref(handle)
        }
        __emval_run_destructors.sig = "vp";
        function __emval_set_property(handle, key, value) {
            handle = Emval.toValue(handle);
            key = Emval.toValue(key);
            value = Emval.toValue(value);
            handle[key] = value
        }
        __emval_set_property.sig = "vppp";
        function __emval_take_value(type, arg) {
            type = requireRegisteredType(type, "_emval_take_value");
            var v = type["readValueFromPointer"](arg);
            return Emval.toHandle(v)
        }
        __emval_take_value.sig = "ppp";
        function readI53FromI64(ptr) {
            return HEAPU32[ptr >> 2] + HEAP32[ptr + 4 >> 2] * 4294967296
        }
        function __gmtime_js(time, tmPtr) {
            var date = new Date(readI53FromI64(time) * 1e3);
            HEAP32[tmPtr >> 2] = date.getUTCSeconds();
            HEAP32[tmPtr + 4 >> 2] = date.getUTCMinutes();
            HEAP32[tmPtr + 8 >> 2] = date.getUTCHours();
            HEAP32[tmPtr + 12 >> 2] = date.getUTCDate();
            HEAP32[tmPtr + 16 >> 2] = date.getUTCMonth();
            HEAP32[tmPtr + 20 >> 2] = date.getUTCFullYear() - 1900;
            HEAP32[tmPtr + 24 >> 2] = date.getUTCDay();
            var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
            var yday = (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0;
            HEAP32[tmPtr + 28 >> 2] = yday
        }
        __gmtime_js.sig = "ipp";
        function __isLeapYear(year) {
            return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
        }
        var __MONTH_DAYS_LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
        var __MONTH_DAYS_REGULAR_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        function __yday_from_date(date) {
            var isLeapYear = __isLeapYear(date.getFullYear());
            var monthDaysCumulative = isLeapYear ? __MONTH_DAYS_LEAP_CUMULATIVE : __MONTH_DAYS_REGULAR_CUMULATIVE;
            var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
            return yday
        }
        function __localtime_js(time, tmPtr) {
            var date = new Date(readI53FromI64(time) * 1e3);
            HEAP32[tmPtr >> 2] = date.getSeconds();
            HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
            HEAP32[tmPtr + 8 >> 2] = date.getHours();
            HEAP32[tmPtr + 12 >> 2] = date.getDate();
            HEAP32[tmPtr + 16 >> 2] = date.getMonth();
            HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
            HEAP32[tmPtr + 24 >> 2] = date.getDay();
            var yday = __yday_from_date(date) | 0;
            HEAP32[tmPtr + 28 >> 2] = yday;
            HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
            var start = new Date(date.getFullYear(),0,1);
            var summerOffset = new Date(date.getFullYear(),6,1).getTimezoneOffset();
            var winterOffset = start.getTimezoneOffset();
            var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
            HEAP32[tmPtr + 32 >> 2] = dst
        }
        __localtime_js.sig = "ipp";
        function __mktime_js(tmPtr) {
            var date = new Date(HEAP32[tmPtr + 20 >> 2] + 1900,HEAP32[tmPtr + 16 >> 2],HEAP32[tmPtr + 12 >> 2],HEAP32[tmPtr + 8 >> 2],HEAP32[tmPtr + 4 >> 2],HEAP32[tmPtr >> 2],0);
            var dst = HEAP32[tmPtr + 32 >> 2];
            var guessedOffset = date.getTimezoneOffset();
            var start = new Date(date.getFullYear(),0,1);
            var summerOffset = new Date(date.getFullYear(),6,1).getTimezoneOffset();
            var winterOffset = start.getTimezoneOffset();
            var dstOffset = Math.min(winterOffset, summerOffset);
            if (dst < 0) {
                HEAP32[tmPtr + 32 >> 2] = Number(summerOffset != winterOffset && dstOffset == guessedOffset)
            } else if (dst > 0 != (dstOffset == guessedOffset)) {
                var nonDstOffset = Math.max(winterOffset, summerOffset);
                var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
                date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4)
            }
            HEAP32[tmPtr + 24 >> 2] = date.getDay();
            var yday = __yday_from_date(date) | 0;
            HEAP32[tmPtr + 28 >> 2] = yday;
            HEAP32[tmPtr >> 2] = date.getSeconds();
            HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
            HEAP32[tmPtr + 8 >> 2] = date.getHours();
            HEAP32[tmPtr + 12 >> 2] = date.getDate();
            HEAP32[tmPtr + 16 >> 2] = date.getMonth();
            HEAP32[tmPtr + 20 >> 2] = date.getYear();
            return date.getTime() / 1e3 | 0
        }
        __mktime_js.sig = "ip";
        function allocateUTF8(str) {
            var size = lengthBytesUTF8(str) + 1;
            var ret = _malloc(size);
            if (ret)
                stringToUTF8Array(str, HEAP8, ret, size);
            return ret
        }
        function __tzset_js(timezone, daylight, tzname) {
            var currentYear = (new Date).getFullYear();
            var winter = new Date(currentYear,0,1);
            var summer = new Date(currentYear,6,1);
            var winterOffset = winter.getTimezoneOffset();
            var summerOffset = summer.getTimezoneOffset();
            var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
            HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;
            HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);
            function extractZone(date) {
                var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
                return match ? match[1] : "GMT"
            }
            var winterName = extractZone(winter);
            var summerName = extractZone(summer);
            var winterNamePtr = allocateUTF8(winterName);
            var summerNamePtr = allocateUTF8(summerName);
            if (summerOffset < winterOffset) {
                HEAPU32[tzname >> 2] = winterNamePtr;
                HEAPU32[tzname + 4 >> 2] = summerNamePtr
            } else {
                HEAPU32[tzname >> 2] = summerNamePtr;
                HEAPU32[tzname + 4 >> 2] = winterNamePtr
            }
        }
        __tzset_js.sig = "vppp";
        function _abort() {
            abort("")
        }
        _abort.sig = "v";
        function _emscripten_date_now() {
            return Date.now()
        }
        _emscripten_date_now.sig = "d";
        var _emscripten_get_now;
        _emscripten_get_now = ()=>performance.now();
        _emscripten_get_now.sig = "d";
        function _emscripten_memcpy_big(dest, src, num) {
            HEAPU8.copyWithin(dest, src, src + num)
        }
        _emscripten_memcpy_big.sig = "vppp";
        function getHeapMax() {
            return 2147483648
        }
        function emscripten_realloc_buffer(size) {
            try {
                wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
                updateGlobalBufferAndViews(wasmMemory.buffer);
                return 1
            } catch (e) {}
        }
        function _emscripten_resize_heap(requestedSize) {
            var oldSize = HEAPU8.length;
            requestedSize = requestedSize >>> 0;
            var maxHeapSize = getHeapMax();
            if (requestedSize > maxHeapSize) {
                return false
            }
            let alignUp = (x,multiple)=>x + (multiple - x % multiple) % multiple;
            for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
                var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
                overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
                var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
                var replacement = emscripten_realloc_buffer(newSize);
                if (replacement) {
                    return true
                }
            }
            return false
        }
        _emscripten_resize_heap.sig = "ip";
        function getExecutableName() {
            return thisProgram || "./this.program"
        }
        function getEnvStrings() {
            if (!getEnvStrings.strings) {
                var lang = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
                var env = {
                    "USER": "web_user",
                    "LOGNAME": "web_user",
                    "PATH": "/",
                    "PWD": "/",
                    "HOME": "/home/web_user",
                    "LANG": lang,
                    "_": getExecutableName()
                };
                for (var x in ENV) {
                    if (ENV[x] === undefined)
                        delete env[x];
                    else
                        env[x] = ENV[x]
                }
                var strings = [];
                for (var x in env) {
                    strings.push(x + "=" + env[x])
                }
                getEnvStrings.strings = strings
            }
            return getEnvStrings.strings
        }
        function writeAsciiToMemory(str, buffer, dontAddNull) {
            for (var i = 0; i < str.length; ++i) {
                HEAP8[buffer++ >> 0] = str.charCodeAt(i)
            }
            if (!dontAddNull)
                HEAP8[buffer >> 0] = 0
        }
        function _environ_get(__environ, environ_buf) {
            var bufSize = 0;
            getEnvStrings().forEach(function(string, i) {
                var ptr = environ_buf + bufSize;
                HEAPU32[__environ + i * 4 >> 2] = ptr;
                writeAsciiToMemory(string, ptr);
                bufSize += string.length + 1
            });
            return 0
        }
        _environ_get.sig = "ipp";
        function _environ_sizes_get(penviron_count, penviron_buf_size) {
            var strings = getEnvStrings();
            HEAPU32[penviron_count >> 2] = strings.length;
            var bufSize = 0;
            strings.forEach(function(string) {
                bufSize += string.length + 1
            });
            HEAPU32[penviron_buf_size >> 2] = bufSize;
            return 0
        }
        _environ_sizes_get.sig = "ipp";
        function _proc_exit(code) {
            EXITSTATUS = code;
            if (!keepRuntimeAlive()) {
                if (Module["onExit"])
                    Module["onExit"](code);
                ABORT = true
            }
            quit_(code, new ExitStatus(code))
        }
        _proc_exit.sig = "vi";
        function exitJS(status, implicit) {
            EXITSTATUS = status;
            _proc_exit(status)
        }
        var _exit = exitJS;
        _exit.sig = "vi";
        function _fd_close(fd) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                FS.close(stream);
                return 0
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return e.errno
            }
        }
        _fd_close.sig = "ii";
        function doReadv(stream, iov, iovcnt, offset) {
            var ret = 0;
            for (var i = 0; i < iovcnt; i++) {
                var ptr = HEAPU32[iov >> 2];
                var len = HEAPU32[iov + 4 >> 2];
                iov += 8;
                var curr = FS.read(stream, HEAP8, ptr, len, offset);
                if (curr < 0)
                    return -1;
                ret += curr;
                if (curr < len)
                    break
            }
            return ret
        }
        function _fd_pread(fd, iov, iovcnt, offset, pnum) {
            try {
                offset = bigintToI53Checked(offset);
                if (isNaN(offset))
                    return 61;
                var stream = SYSCALLS.getStreamFromFD(fd);
                var num = doReadv(stream, iov, iovcnt, offset);
                HEAPU32[pnum >> 2] = num;
                return 0
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return e.errno
            }
        }
        _fd_pread.sig = "iippjp";
        function doWritev(stream, iov, iovcnt, offset) {
            var ret = 0;
            for (var i = 0; i < iovcnt; i++) {
                var ptr = HEAPU32[iov >> 2];
                var len = HEAPU32[iov + 4 >> 2];
                iov += 8;
                var curr = FS.write(stream, HEAP8, ptr, len, offset);
                if (curr < 0)
                    return -1;
                ret += curr
            }
            return ret
        }
        function _fd_pwrite(fd, iov, iovcnt, offset, pnum) {
            try {
                offset = bigintToI53Checked(offset);
                if (isNaN(offset))
                    return 61;
                var stream = SYSCALLS.getStreamFromFD(fd);
                var num = doWritev(stream, iov, iovcnt, offset);
                HEAPU32[pnum >> 2] = num;
                return 0
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return e.errno
            }
        }
        _fd_pwrite.sig = "iippjp";
        function _fd_read(fd, iov, iovcnt, pnum) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                var num = doReadv(stream, iov, iovcnt);
                HEAPU32[pnum >> 2] = num;
                return 0
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return e.errno
            }
        }
        _fd_read.sig = "iippp";
        function _fd_seek(fd, offset, whence, newOffset) {
            try {
                offset = bigintToI53Checked(offset);
                if (isNaN(offset))
                    return 61;
                var stream = SYSCALLS.getStreamFromFD(fd);
                FS.llseek(stream, offset, whence);
                tempI64 = [stream.position >>> 0, (tempDouble = stream.position,
                +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                HEAP32[newOffset >> 2] = tempI64[0],
                HEAP32[newOffset + 4 >> 2] = tempI64[1];
                if (stream.getdents && offset === 0 && whence === 0)
                    stream.getdents = null;
                return 0
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return e.errno
            }
        }
        _fd_seek.sig = "iijip";
        function _fd_write(fd, iov, iovcnt, pnum) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                var num = doWritev(stream, iov, iovcnt);
                HEAPU32[pnum >> 2] = num;
                return 0
            } catch (e) {
                if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError))
                    throw e;
                return e.errno
            }
        }
        _fd_write.sig = "iippp";
        function __arraySum(array, index) {
            var sum = 0;
            for (var i = 0; i <= index; sum += array[i++]) {}
            return sum
        }
        var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        function __addDays(date, days) {
            var newDate = new Date(date.getTime());
            while (days > 0) {
                var leap = __isLeapYear(newDate.getFullYear());
                var currentMonth = newDate.getMonth();
                var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
                if (days > daysInCurrentMonth - newDate.getDate()) {
                    days -= daysInCurrentMonth - newDate.getDate() + 1;
                    newDate.setDate(1);
                    if (currentMonth < 11) {
                        newDate.setMonth(currentMonth + 1)
                    } else {
                        newDate.setMonth(0);
                        newDate.setFullYear(newDate.getFullYear() + 1)
                    }
                } else {
                    newDate.setDate(newDate.getDate() + days);
                    return newDate
                }
            }
            return newDate
        }
        function writeArrayToMemory(array, buffer) {
            HEAP8.set(array, buffer)
        }
        function _strftime(s, maxsize, format, tm) {
            var tm_zone = HEAP32[tm + 40 >> 2];
            var date = {
                tm_sec: HEAP32[tm >> 2],
                tm_min: HEAP32[tm + 4 >> 2],
                tm_hour: HEAP32[tm + 8 >> 2],
                tm_mday: HEAP32[tm + 12 >> 2],
                tm_mon: HEAP32[tm + 16 >> 2],
                tm_year: HEAP32[tm + 20 >> 2],
                tm_wday: HEAP32[tm + 24 >> 2],
                tm_yday: HEAP32[tm + 28 >> 2],
                tm_isdst: HEAP32[tm + 32 >> 2],
                tm_gmtoff: HEAP32[tm + 36 >> 2],
                tm_zone: tm_zone ? UTF8ToString(tm_zone) : ""
            };
            var pattern = UTF8ToString(format);
            var EXPANSION_RULES_1 = {
                "%c": "%a %b %d %H:%M:%S %Y",
                "%D": "%m/%d/%y",
                "%F": "%Y-%m-%d",
                "%h": "%b",
                "%r": "%I:%M:%S %p",
                "%R": "%H:%M",
                "%T": "%H:%M:%S",
                "%x": "%m/%d/%y",
                "%X": "%H:%M:%S",
                "%Ec": "%c",
                "%EC": "%C",
                "%Ex": "%m/%d/%y",
                "%EX": "%H:%M:%S",
                "%Ey": "%y",
                "%EY": "%Y",
                "%Od": "%d",
                "%Oe": "%e",
                "%OH": "%H",
                "%OI": "%I",
                "%Om": "%m",
                "%OM": "%M",
                "%OS": "%S",
                "%Ou": "%u",
                "%OU": "%U",
                "%OV": "%V",
                "%Ow": "%w",
                "%OW": "%W",
                "%Oy": "%y"
            };
            for (var rule in EXPANSION_RULES_1) {
                pattern = pattern.replace(new RegExp(rule,"g"), EXPANSION_RULES_1[rule])
            }
            var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            function leadingSomething(value, digits, character) {
                var str = typeof value == "number" ? value.toString() : value || "";
                while (str.length < digits) {
                    str = character[0] + str
                }
                return str
            }
            function leadingNulls(value, digits) {
                return leadingSomething(value, digits, "0")
            }
            function compareByDay(date1, date2) {
                function sgn(value) {
                    return value < 0 ? -1 : value > 0 ? 1 : 0
                }
                var compare;
                if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
                    if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                        compare = sgn(date1.getDate() - date2.getDate())
                    }
                }
                return compare
            }
            function getFirstWeekStartDate(janFourth) {
                switch (janFourth.getDay()) {
                case 0:
                    return new Date(janFourth.getFullYear() - 1,11,29);
                case 1:
                    return janFourth;
                case 2:
                    return new Date(janFourth.getFullYear(),0,3);
                case 3:
                    return new Date(janFourth.getFullYear(),0,2);
                case 4:
                    return new Date(janFourth.getFullYear(),0,1);
                case 5:
                    return new Date(janFourth.getFullYear() - 1,11,31);
                case 6:
                    return new Date(janFourth.getFullYear() - 1,11,30)
                }
            }
            function getWeekBasedYear(date) {
                var thisDate = __addDays(new Date(date.tm_year + 1900,0,1), date.tm_yday);
                var janFourthThisYear = new Date(thisDate.getFullYear(),0,4);
                var janFourthNextYear = new Date(thisDate.getFullYear() + 1,0,4);
                var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
                var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
                if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
                    if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                        return thisDate.getFullYear() + 1
                    }
                    return thisDate.getFullYear()
                }
                return thisDate.getFullYear() - 1
            }
            var EXPANSION_RULES_2 = {
                "%a": function(date) {
                    return WEEKDAYS[date.tm_wday].substring(0, 3)
                },
                "%A": function(date) {
                    return WEEKDAYS[date.tm_wday]
                },
                "%b": function(date) {
                    return MONTHS[date.tm_mon].substring(0, 3)
                },
                "%B": function(date) {
                    return MONTHS[date.tm_mon]
                },
                "%C": function(date) {
                    var year = date.tm_year + 1900;
                    return leadingNulls(year / 100 | 0, 2)
                },
                "%d": function(date) {
                    return leadingNulls(date.tm_mday, 2)
                },
                "%e": function(date) {
                    return leadingSomething(date.tm_mday, 2, " ")
                },
                "%g": function(date) {
                    return getWeekBasedYear(date).toString().substring(2)
                },
                "%G": function(date) {
                    return getWeekBasedYear(date)
                },
                "%H": function(date) {
                    return leadingNulls(date.tm_hour, 2)
                },
                "%I": function(date) {
                    var twelveHour = date.tm_hour;
                    if (twelveHour == 0)
                        twelveHour = 12;
                    else if (twelveHour > 12)
                        twelveHour -= 12;
                    return leadingNulls(twelveHour, 2)
                },
                "%j": function(date) {
                    return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3)
                },
                "%m": function(date) {
                    return leadingNulls(date.tm_mon + 1, 2)
                },
                "%M": function(date) {
                    return leadingNulls(date.tm_min, 2)
                },
                "%n": function() {
                    return "\n"
                },
                "%p": function(date) {
                    if (date.tm_hour >= 0 && date.tm_hour < 12) {
                        return "AM"
                    }
                    return "PM"
                },
                "%S": function(date) {
                    return leadingNulls(date.tm_sec, 2)
                },
                "%t": function() {
                    return "\t"
                },
                "%u": function(date) {
                    return date.tm_wday || 7
                },
                "%U": function(date) {
                    var days = date.tm_yday + 7 - date.tm_wday;
                    return leadingNulls(Math.floor(days / 7), 2)
                },
                "%V": function(date) {
                    var val = Math.floor((date.tm_yday + 7 - (date.tm_wday + 6) % 7) / 7);
                    if ((date.tm_wday + 371 - date.tm_yday - 2) % 7 <= 2) {
                        val++
                    }
                    if (!val) {
                        val = 52;
                        var dec31 = (date.tm_wday + 7 - date.tm_yday - 1) % 7;
                        if (dec31 == 4 || dec31 == 5 && __isLeapYear(date.tm_year % 400 - 1)) {
                            val++
                        }
                    } else if (val == 53) {
                        var jan1 = (date.tm_wday + 371 - date.tm_yday) % 7;
                        if (jan1 != 4 && (jan1 != 3 || !__isLeapYear(date.tm_year)))
                            val = 1
                    }
                    return leadingNulls(val, 2)
                },
                "%w": function(date) {
                    return date.tm_wday
                },
                "%W": function(date) {
                    var days = date.tm_yday + 7 - (date.tm_wday + 6) % 7;
                    return leadingNulls(Math.floor(days / 7), 2)
                },
                "%y": function(date) {
                    return (date.tm_year + 1900).toString().substring(2)
                },
                "%Y": function(date) {
                    return date.tm_year + 1900
                },
                "%z": function(date) {
                    var off = date.tm_gmtoff;
                    var ahead = off >= 0;
                    off = Math.abs(off) / 60;
                    off = off / 60 * 100 + off % 60;
                    return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
                },
                "%Z": function(date) {
                    return date.tm_zone
                },
                "%%": function() {
                    return "%"
                }
            };
            pattern = pattern.replace(/%%/g, "\0\0");
            for (var rule in EXPANSION_RULES_2) {
                if (pattern.includes(rule)) {
                    pattern = pattern.replace(new RegExp(rule,"g"), EXPANSION_RULES_2[rule](date))
                }
            }
            pattern = pattern.replace(/\0\0/g, "%");
            var bytes = intArrayFromString(pattern, false);
            if (bytes.length > maxsize) {
                return 0
            }
            writeArrayToMemory(bytes, s);
            return bytes.length - 1
        }
        _strftime.sig = "ppppp";
        function handleException(e) {
            if (e instanceof ExitStatus || e == "unwind") {
                return EXITSTATUS
            }
            quit_(1, e)
        }
        function getCFunc(ident) {
            var func = Module["_" + ident];
            return func
        }
        function ccall(ident, returnType, argTypes, args, opts) {
            var toC = {
                "string": str=>{
                    var ret = 0;
                    if (str !== null && str !== undefined && str !== 0) {
                        var len = (str.length << 2) + 1;
                        ret = stackAlloc(len);
                        stringToUTF8(str, ret, len)
                    }
                    return ret
                }
                ,
                "array": arr=>{
                    var ret = stackAlloc(arr.length);
                    writeArrayToMemory(arr, ret);
                    return ret
                }
            };
            function convertReturnValue(ret) {
                if (returnType === "string") {
                    return UTF8ToString(ret)
                }
                if (returnType === "boolean")
                    return Boolean(ret);
                return ret
            }
            var func = getCFunc(ident);
            var cArgs = [];
            var stack = 0;
            if (args) {
                for (var i = 0; i < args.length; i++) {
                    var converter = toC[argTypes[i]];
                    if (converter) {
                        if (stack === 0)
                            stack = stackSave();
                        cArgs[i] = converter(args[i])
                    } else {
                        cArgs[i] = args[i]
                    }
                }
            }
            var ret = func.apply(null, cArgs);
            function onDone(ret) {
                if (stack !== 0)
                    stackRestore(stack);
                return convertReturnValue(ret)
            }
            ret = onDone(ret);
            return ret
        }
        function cwrap(ident, returnType, argTypes, opts) {
            argTypes = argTypes || [];
            var numericArgs = argTypes.every(type=>type === "number" || type === "boolean");
            var numericRet = returnType !== "string";
            if (numericRet && numericArgs && !opts) {
                return getCFunc(ident)
            }
            return function() {
                return ccall(ident, returnType, argTypes, arguments, opts)
            }
        }
        function AsciiToString(ptr) {
            var str = "";
            while (1) {
                var ch = HEAPU8[ptr++ >> 0];
                if (!ch)
                    return str;
                str += String.fromCharCode(ch)
            }
        }
        var FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
                parent = this
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev
        };
        var readMode = 292 | 73;
        var writeMode = 146;
        Object.defineProperties(FSNode.prototype, {
            read: {
                get: function() {
                    return (this.mode & readMode) === readMode
                },
                set: function(val) {
                    val ? this.mode |= readMode : this.mode &= ~readMode
                }
            },
            write: {
                get: function() {
                    return (this.mode & writeMode) === writeMode
                },
                set: function(val) {
                    val ? this.mode |= writeMode : this.mode &= ~writeMode
                }
            },
            isFolder: {
                get: function() {
                    return FS.isDir(this.mode)
                }
            },
            isDevice: {
                get: function() {
                    return FS.isChrdev(this.mode)
                }
            }
        });
        FS.FSNode = FSNode;
        FS.staticInit();
        Module["FS_createPath"] = FS.createPath;
        Module["FS_createDataFile"] = FS.createDataFile;
        Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
        Module["FS_unlink"] = FS.unlink;
        Module["FS_createLazyFile"] = FS.createLazyFile;
        Module["FS_createDevice"] = FS.createDevice;
        embind_init_charCodes();
        BindingError = Module["BindingError"] = extendError(Error, "BindingError");
        InternalError = Module["InternalError"] = extendError(Error, "InternalError");
        init_ClassHandle();
        init_embind();
        init_RegisteredPointer();
        UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
        init_emval();
        var ASSERTIONS = false;
        var decodeBase64 = typeof atob == "function" ? atob : function(input) {
            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var output = "";
            var chr1, chr2, chr3;
            var enc1, enc2, enc3, enc4;
            var i = 0;
            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
            do {
                enc1 = keyStr.indexOf(input.charAt(i++));
                enc2 = keyStr.indexOf(input.charAt(i++));
                enc3 = keyStr.indexOf(input.charAt(i++));
                enc4 = keyStr.indexOf(input.charAt(i++));
                chr1 = enc1 << 2 | enc2 >> 4;
                chr2 = (enc2 & 15) << 4 | enc3 >> 2;
                chr3 = (enc3 & 3) << 6 | enc4;
                output = output + String.fromCharCode(chr1);
                if (enc3 !== 64) {
                    output = output + String.fromCharCode(chr2)
                }
                if (enc4 !== 64) {
                    output = output + String.fromCharCode(chr3)
                }
            } while (i < input.length);
            return output
        }
        ;
        function intArrayFromBase64(s) {
            try {
                var decoded = decodeBase64(s);
                var bytes = new Uint8Array(decoded.length);
                for (var i = 0; i < decoded.length; ++i) {
                    bytes[i] = decoded.charCodeAt(i)
                }
                return bytes
            } catch (_) {
                throw new Error("Converting base64 string to bytes failed.")
            }
        }
        function tryParseAsDataURI(filename) {
            if (!isDataURI(filename)) {
                return
            }
            return intArrayFromBase64(filename.slice(dataURIPrefix.length))
        }
        var asmLibraryArg = {
            "__assert_fail": ___assert_fail,
            "__cxa_throw": ___cxa_throw,
            "__heap_base": ___heap_base,
            "__indirect_function_table": wasmTable,
            "__memory_base": ___memory_base,
            "__stack_pointer": ___stack_pointer,
            "__syscall_faccessat": ___syscall_faccessat,
            "__syscall_fcntl64": ___syscall_fcntl64,
            "__syscall_fstat64": ___syscall_fstat64,
            "__syscall_ftruncate64": ___syscall_ftruncate64,
            "__syscall_getcwd": ___syscall_getcwd,
            "__syscall_getdents64": ___syscall_getdents64,
            "__syscall_ioctl": ___syscall_ioctl,
            "__syscall_lstat64": ___syscall_lstat64,
            "__syscall_newfstatat": ___syscall_newfstatat,
            "__syscall_openat": ___syscall_openat,
            "__syscall_readlinkat": ___syscall_readlinkat,
            "__syscall_stat64": ___syscall_stat64,
            "__table_base": ___table_base,
            "_dlinit": __dlinit,
            "_dlopen_js": __dlopen_js,
            "_dlsym_js": __dlsym_js,
            "_embind_register_bigint": __embind_register_bigint,
            "_embind_register_bool": __embind_register_bool,
            "_embind_register_class": __embind_register_class,
            "_embind_register_class_constructor": __embind_register_class_constructor,
            "_embind_register_class_function": __embind_register_class_function,
            "_embind_register_class_property": __embind_register_class_property,
            "_embind_register_constant": __embind_register_constant,
            "_embind_register_emval": __embind_register_emval,
            "_embind_register_enum": __embind_register_enum,
            "_embind_register_enum_value": __embind_register_enum_value,
            "_embind_register_float": __embind_register_float,
            "_embind_register_function": __embind_register_function,
            "_embind_register_integer": __embind_register_integer,
            "_embind_register_memory_view": __embind_register_memory_view,
            "_embind_register_std_string": __embind_register_std_string,
            "_embind_register_std_wstring": __embind_register_std_wstring,
            "_embind_register_void": __embind_register_void,
            "_emval_as": __emval_as,
            "_emval_as_uint64": __emval_as_uint64,
            "_emval_decref": __emval_decref,
            "_emval_equals": __emval_equals,
            "_emval_get_property": __emval_get_property,
            "_emval_incref": __emval_incref,
            "_emval_new_array": __emval_new_array,
            "_emval_new_cstring": __emval_new_cstring,
            "_emval_new_object": __emval_new_object,
            "_emval_run_destructors": __emval_run_destructors,
            "_emval_set_property": __emval_set_property,
            "_emval_take_value": __emval_take_value,
            "_gmtime_js": __gmtime_js,
            "_localtime_js": __localtime_js,
            "_mktime_js": __mktime_js,
            "_tzset_js": __tzset_js,
            "abort": _abort,
            "emscripten_date_now": _emscripten_date_now,
            "emscripten_get_now": _emscripten_get_now,
            "emscripten_memcpy_big": _emscripten_memcpy_big,
            "emscripten_resize_heap": _emscripten_resize_heap,
            "environ_get": _environ_get,
            "environ_sizes_get": _environ_sizes_get,
            "exit": _exit,
            "fd_close": _fd_close,
            "fd_pread": _fd_pread,
            "fd_pwrite": _fd_pwrite,
            "fd_read": _fd_read,
            "fd_seek": _fd_seek,
            "fd_write": _fd_write,
            "memory": wasmMemory,
            "strftime": _strftime,
            "throw_error": throw_error
        };
        var asm = createWasm();
        var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
            return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["__wasm_call_ctors"]).apply(null, arguments)
        }
        ;
        var ___wasm_apply_data_relocs = Module["___wasm_apply_data_relocs"] = function() {
            return (___wasm_apply_data_relocs = Module["___wasm_apply_data_relocs"] = Module["asm"]["__wasm_apply_data_relocs"]).apply(null, arguments)
        }
        ;
        var _H5Fcreate = Module["_H5Fcreate"] = function() {
            return (_H5Fcreate = Module["_H5Fcreate"] = Module["asm"]["H5Fcreate"]).apply(null, arguments)
        }
        ;
        var _H5Fopen = Module["_H5Fopen"] = function() {
            return (_H5Fopen = Module["_H5Fopen"] = Module["asm"]["H5Fopen"]).apply(null, arguments)
        }
        ;
        var _H5Fclose = Module["_H5Fclose"] = function() {
            return (_H5Fclose = Module["_H5Fclose"] = Module["asm"]["H5Fclose"]).apply(null, arguments)
        }
        ;
        var _malloc = Module["_malloc"] = function() {
            return (_malloc = Module["_malloc"] = Module["asm"]["malloc"]).apply(null, arguments)
        }
        ;
        var _free = Module["_free"] = function() {
            return (_free = Module["_free"] = Module["asm"]["free"]).apply(null, arguments)
        }
        ;
        var _memcpy = Module["_memcpy"] = function() {
            return (_memcpy = Module["_memcpy"] = Module["asm"]["memcpy"]).apply(null, arguments)
        }
        ;
        var _memset = Module["_memset"] = function() {
            return (_memset = Module["_memset"] = Module["asm"]["memset"]).apply(null, arguments)
        }
        ;
        var ___errno_location = Module["___errno_location"] = function() {
            return (___errno_location = Module["___errno_location"] = Module["asm"]["__errno_location"]).apply(null, arguments)
        }
        ;
        var ___getTypeName = Module["___getTypeName"] = function() {
            return (___getTypeName = Module["___getTypeName"] = Module["asm"]["__getTypeName"]).apply(null, arguments)
        }
        ;
        var __embind_initialize_bindings = Module["__embind_initialize_bindings"] = function() {
            return (__embind_initialize_bindings = Module["__embind_initialize_bindings"] = Module["asm"]["_embind_initialize_bindings"]).apply(null, arguments)
        }
        ;
        var ___dl_seterr = Module["___dl_seterr"] = function() {
            return (___dl_seterr = Module["___dl_seterr"] = Module["asm"]["__dl_seterr"]).apply(null, arguments)
        }
        ;
        var _setThrew = Module["_setThrew"] = function() {
            return (_setThrew = Module["_setThrew"] = Module["asm"]["setThrew"]).apply(null, arguments)
        }
        ;
        var stackSave = Module["stackSave"] = function() {
            return (stackSave = Module["stackSave"] = Module["asm"]["stackSave"]).apply(null, arguments)
        }
        ;
        var stackRestore = Module["stackRestore"] = function() {
            return (stackRestore = Module["stackRestore"] = Module["asm"]["stackRestore"]).apply(null, arguments)
        }
        ;
        var stackAlloc = Module["stackAlloc"] = function() {
            return (stackAlloc = Module["stackAlloc"] = Module["asm"]["stackAlloc"]).apply(null, arguments)
        }
        ;
        var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function() {
            return (___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = Module["asm"]["__cxa_is_pointer_type"]).apply(null, arguments)
        }
        ;
        var _stderr = Module["_stderr"] = 326480;
        Module["UTF8ToString"] = UTF8ToString;
        Module["addRunDependency"] = addRunDependency;
        Module["removeRunDependency"] = removeRunDependency;
        Module["FS_createPath"] = FS.createPath;
        Module["FS_createDataFile"] = FS.createDataFile;
        Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
        Module["FS_createLazyFile"] = FS.createLazyFile;
        Module["FS_createDevice"] = FS.createDevice;
        Module["FS_unlink"] = FS.unlink;
        Module["ccall"] = ccall;
        Module["cwrap"] = cwrap;
        Module["AsciiToString"] = AsciiToString;
        Module["FS"] = FS;
        var calledRun;
        dependenciesFulfilled = function runCaller() {
            if (!calledRun)
                run();
            if (!calledRun)
                dependenciesFulfilled = runCaller
        }
        ;
        function callMain(args) {
            var entryFunction = Module["_main"];
            if (!entryFunction)
                return;
            args = args || [];
            args.unshift(thisProgram);
            var argc = args.length;
            var argv = stackAlloc((argc + 1) * 4);
            var argv_ptr = argv >> 2;
            args.forEach(arg=>{
                HEAP32[argv_ptr++] = allocateUTF8OnStack(arg)
            }
            );
            HEAP32[argv_ptr] = 0;
            try {
                var ret = entryFunction(argc, argv);
                exitJS(ret, true);
                return ret
            } catch (e) {
                return handleException(e)
            }
        }
        var dylibsLoaded = false;
        function run(args) {
            args = args || arguments_;
            if (runDependencies > 0) {
                return
            }
            if (!dylibsLoaded) {
                preloadDylibs();
                dylibsLoaded = true;
                if (runDependencies > 0) {
                    return
                }
            }
            preRun();
            if (runDependencies > 0) {
                return
            }
            function doRun() {
                if (calledRun)
                    return;
                calledRun = true;
                Module["calledRun"] = true;
                if (ABORT)
                    return;
                initRuntime();
                preMain();
                readyPromiseResolve(Module);
                if (Module["onRuntimeInitialized"])
                    Module["onRuntimeInitialized"]();
                if (shouldRunNow)
                    callMain(args);
                postRun()
            }
            if (Module["setStatus"]) {
                Module["setStatus"]("Running...");
                setTimeout(function() {
                    setTimeout(function() {
                        Module["setStatus"]("")
                    }, 1);
                    doRun()
                }, 1)
            } else {
                doRun()
            }
        }
        if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function")
                Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
                Module["preInit"].pop()()
            }
        }
        var shouldRunNow = true;
        if (Module["noInitialRun"])
            shouldRunNow = false;
        run();

        return Module.ready
    }
    );
}
)();
export default Module;
