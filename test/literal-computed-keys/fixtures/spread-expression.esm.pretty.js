
let a = ["put", "add", "delete", "clear"];
export function SpreadExpression(){
  return {...a, get:() => console.log("get thing")};
};
