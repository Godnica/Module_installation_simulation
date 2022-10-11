module.exports = {
    /**
     * Install a module and all its dependencies
     *
     * @param {String} moduleName
     * @param {Object} moduleManager
     * @return {Promise} resolve only when the module and ALL its dependencies are installed (or already there),
     * reject if it cannot be installed with the following error code:
     * - 'ERROR_MODULE_UNKNOWN' if the module does not exist
     * - 'ERROR_MODULE_DEPENDENCIES' if the module cannot be installed because of its dependencies
     */
    async installModule(
        moduleName,
        {
            getInstalledModuleNames,
            simpleInstallModule,
            getModule
        })
        {
            
            const listNames = await getInstalledModuleNames();

            const mod = getModule(moduleName)
            if(!mod){
                return Promise.reject('ERROR_MODULE_UNKNOWN')
            }
            
            let listNeed = [mod.name];
            let track = []

            /**
             * @param {Array} arraytocontroll              
             * @return {void} 
             * Utility function that receives an array as input and detects if the array values ​​repeat
             */
            const tracker = (arraytocontroll)=>{
                track.push(arraytocontroll);
                const flatarray = track.flat()
                if(flatarray.length%2==0){
                    const middleIndex = Math.ceil(flatarray.length / 2);
                    const firstHalf = flatarray.splice(0, middleIndex);
                    const secondHalf = flatarray.splice(-middleIndex);
                    for(let i = 0; i <middleIndex; i++){
                        if(firstHalf[i]!==secondHalf[i]){
                            break
                        }else if(firstHalf[i]==secondHalf[i] && i === middleIndex - 1){
                            throw "ERROR_MODULE_DEPENDENCIES"
                        }
                    }

                }
            }

            /**
             * @param {Array} arrRequired 
             * @param {Array} arrJusthave
             * @return {Promise} 
             * This recursive function receives as input an array of dependencies and an array of modules that are already installed.
             * To avoid creating a dependency loop, the function has a counter that warns us in the event that a turn on the array of the installed modules
             * has been performed without having installed anything new.
             */
            const dipendeNcer = (arrRequired, arrJusthave) =>{    
                
                tracker(arrRequired);

                arrRequired.forEach(required => {   
                    if(!arrJusthave.includes(required)){
                        arrJusthave.splice(0,0, required)
                    }                    
                    arrJusthave.splice(0,0, ...getModule(required).requires);
                    listNeed = [...new Set(arrJusthave)];                                       
                    dipendeNcer(getModule(required).requires, arrJusthave)               
                });                                                
            }

            try {                
                dipendeNcer(mod.requires, listNeed);   
            } catch (error) {
                return Promise.reject(error)
            }

            listNeed = [...new Set(listNeed)];
            
            // this array defines the names of the modules to be installed, in order of dependency
            const difference = listNeed.filter(x => !listNames.includes(x));

            //the promise is instantiated that it will be returned
            let p = Promise.resolve();

            //cascading promises are instantiated to be resolved upon resolution of the base promise
            for(let i = 0; i<difference.length; i++){    
                if(difference[i]){
                    p = p.then(function() {
                        return Promise.resolve(simpleInstallModule(difference[i]));
                    });
                }                
            }

            return p            

        }
};