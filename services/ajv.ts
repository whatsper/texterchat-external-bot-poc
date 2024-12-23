import Ajv from 'ajv';

export function createAjv(){
    return {
        ajv: new Ajv({
            allowUnionTypes: true,
        }),
    };
}
