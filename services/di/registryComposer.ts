/**
 * Dynamically build type-safe registry of services.
 *
 * Every new invocation of `add()` method will extend the registry with new services.
 *
 * In next invocations of `add()` method, services creator function receives all previously added/replaced services.
 *
 * `compose()` method builds registry invoking service creators and returns readonly registry object with all services.
 *
 * Source: https://dev.to/vad3x/typesafe-almost-zero-cost-dependency-injection-in-typescript-112
 *
 */
export class RegistryComposer<TNeeds extends object = object> {

    private readonly creators: CreateServices<TNeeds, object>[] = [];

    /**
     * Add services creator which will add/change service(s) to/in the registry during `compose()` method invocation.
     *
     * @param createServices
     * @returns this
     */
    add<TServices extends object>(
        createServices: CreateServices<TNeeds, TServices>
    ): RegistryComposer<Combine<TNeeds, TServices>> {
        this.creators.push(createServices);

        return this as any;
    }

    /**
     * Compose registry object
     *
     * @returns Readonly registry object with all services created by service creators added by `add()` method.
     */
    compose(): Readonly<TNeeds> {
        return Object.freeze(
            this.creators.reduce((state, createServices) => {
                return Object.assign(state, createServices(state));
            }, {} as any)
        );
    }
}

type CreateServices<TNeeds, TServices extends object> = (
    needs: TNeeds
) => TServices;

type Combine<TSource extends object, TWith extends object> = Norm<
    Omit<TSource, keyof TWith> & TWith
>;

type Norm<T> = T extends object
    ? {
        [P in keyof T]: T[P];
    }
    : never;
