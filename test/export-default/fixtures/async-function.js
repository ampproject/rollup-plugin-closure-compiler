export async function asyncTest() {
    await Promise.resolve('async-test');
    console.log('async-test')
}

export async function asyncTestWithArgument(argument) {
    await Promise.resolve('async-test-with-argument');
    console.log(argument)
}