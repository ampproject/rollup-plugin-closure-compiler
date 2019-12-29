function b(a){this.name_=a}b.prototype.console=function(){console.log(this.name_)};function bar(){console.log(1)};function baz(a){console.log(a)};var foo=1;export{b as ExportedClass,bar,baz,foo};
