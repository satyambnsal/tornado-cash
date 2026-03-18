declare module "circom_tester" {
    export interface CircuitTester {
        calculateWitness(input: any, sanityCheck?: boolean): Promise<any>;
        assertOut(witness: any, expected: any): Promise<void>;
        checkConstraints(witness: any): Promise<void>;
        getDecoratedOutput(witness: any): Promise<any>;
    }

    export interface WasmTesterOptions {
        output?: string;
        recompile?: boolean;
    }

    export function wasm(circuitPath: string, options?: WasmTesterOptions): Promise<CircuitTester>;
}

declare module "snarkjs" {
    export namespace groth16 {
        function fullProve(
            input: any,
            wasmFile: string | Uint8Array,
            zkeyFile: string | Uint8Array
        ): Promise<{ proof: any; publicSignals: any }>;

        function verify(
            vk_verifier: any,
            publicSignals: any,
            proof: any
        ): Promise<boolean>;
    }

    export namespace zKey {
        function exportVerificationKey(zkeyBytes: Uint8Array): Promise<any>;
    }
}
