

/*
 *  DataBinder
 * */
 
function DataBinder(obj){
	this.el = obj.el || "";
	this.data={};
	this.methods;
	this.compiler;
	this.observer;
	this.watcher;
	this.init(obj);
}

DataBinder.prototype = {
	init:function(obj){
		let dom = document.querySelector(this.el);
		if(dom === null){
			console.warn("Do not have available elements.");
			return;
		}
		if(obj.methods && typeof obj.methods === "object"){
			this.methods = obj.methods;
		}else{
			this.methods= {};
		}
		this.emptyData(obj);
		this.observer = new MvvmObserver(this);
		this.compiler = new MvvmCompiler(dom,this);
		this.watcher = new MvvmWatcher(this);
		this.initData(obj);
	},
	//copy data ,clear value
	emptyData:function(obj){
		if(obj.data && typeof obj.data === "object"){
			let tempObj =JSON.parse(JSON.stringify(obj.data));
			for(let item in tempObj){
				tempObj[item] = "";
			}
			this.data = tempObj;
		}else{
			console.warn("DataBinder.data must be an object!");
		}
	},
	// init data value and view
	initData:function(obj){
	    if(obj.data && typeof obj.data === "object"){
			for(let item in obj.data){
				this.data[item] = obj.data[item];
			}
		}else{
			console.warn("DataBinder.data must be an object!");
		}
	}
}

/*
 *  Observer
 * */
 
function MvvmObserver(mvvm){
	this.mvvm = mvvm;
	this.data = mvvm.data;
	this.updateData ={data:{}};
	this.init();
}

MvvmObserver.prototype = {
	init:function(){
		this.observe(this.data);
	},
	observe:function($data){
		let __this =this;
		if (!$data || typeof $data !== 'object') {
		    return;
		}
		Object.keys($data).forEach(function(key) {
		    __this.defineProp($data, key, $data[key]);
		});
	},
	defineProp:function(data, key, val){
		let __this = this;
		Object.defineProperty(data, key, {
		    enumerable: true, // 可枚举
		    configurable: false, // 不能再define
		    get: function() {
		        return val;
		    },
		    set: function(newVal) {
				if(val !== newVal){
					val = newVal;
					__this.notify(data,key,newVal);
				}else{
					return;
				}
		    }
		});
	},
	//notify
	notify:function(data,key,newVal){
		let obj = {srcObj:data,updateKey:key,updateVal:newVal};
		this.updateData.data = obj;
		this.mvvm.watcher.receive(data,key,newVal);
	}
}

/*
 *  Compiler
 * */

function MvvmCompiler(dom,mvvm){
	this.dom = dom;
	this.mvvm = mvvm;
	this.elements = [];
	this.parseDom(dom);
	this.addEvents();
}

MvvmCompiler.prototype = {
	parseDom:function(target){
		if(target){
			let obj = this.compile(target);	
			this.elements.push(obj);
			if(target.children && target.children.length >0){
				for(let i=0; i< target.children.length; i++){
					this.parseDom(target.children[i]);
				}
			}else{
				//console.log("没有子节点");
			}
		}
	},
	compile:function(target){
		let output={events:[],attrs:{},vars:[],id:"",hasChild:true,text:"",dom:target};
		if(target.id && target.id !== null){
			output.id = target.id;
		}
		if(target.attributes && target.attributes !== null){
			for(let i=0; i<target.attributes.length;i++){
				if(/^(d-)[A-Za-z]{1,}[\:][A-Za-z0-9]{1,}$/.test(target.attributes[i].nodeName)){
					let instructArr = target.attributes[i].nodeName.split(":");
					let instruct = instructArr[0];
					let instructAttr = instructArr[1];
					switch(instruct){
						case "d-on":
							output.events.push({
								[instructAttr]:target.attributes[i].nodeValue
							});
							break;
						case "d-bind":
							output.attrs[target.attributes[i].nodeValue] = instructAttr;
							
							break;
						default:
							break;
					}
				}
			}
		}
		if(target.children && target.children.length === 0){	
			let content = target.innerHTML;
			output.hasChild = false;
			output.text = content;
			let reg = /\{\{[A-Za-z\$\_][A-Za-z0-9]{0,}\}\}/g;
			let regRes = content.match(reg);
			if(regRes && regRes.length>0){
				for(let k=0; k<regRes.length; k++){
					regRes[k] = regRes[k].replace(/\{\{([A-Za-z\$\_][A-Za-z0-9]{0,})\}\}/,"$1");
					output.vars.push(regRes[k]);
				}
			}
		}
		return output;
	},
	addEvents:function(){
		let dataArr = this.elements;
		for(let i=0; i<dataArr.length; i++){
			for(let j=0; j<dataArr[i].events.length; j++){
				for(let item in dataArr[i].events[j]){			
					dataArr[i].dom.addEventListener(item,this.mvvm.methods[ dataArr[i].events[j][item] ].bind(this.mvvm));
				}
			}
		}
	},
	receive:function(data,key,newVal){
		this.update({updateKey:key,updateVal:newVal});
	},
	update:function(updateObj){
		let __this = this;
		let compilerData = this.elements;
		for(let i=0; i<compilerData.length; i++){
			for(let item in compilerData[i].attrs){
				if(item ===updateObj.updateKey){
					compilerData[i].dom.setAttribute(compilerData[i].attrs[item],updateObj.updateVal);
				}
			}
		
			for(let k=0; k<compilerData[i].vars.length; k++){
				if(compilerData[i].vars[k] === updateObj.updateKey){
					let reg = new RegExp("\{\{"+updateObj.updateKey+"\}\}");
					let htmlStr = compilerData[i].text.replace(reg,updateObj.updateVal); 
					__this.updateText(compilerData[i].dom,htmlStr);
				}
			}
		}
	},
	updateText:function(dom,str){
		let reg = /\{\{([A-Za-z\$\_][A-Za-z0-9]{0,})\}\}/g;
		let arr = str.match(reg);
		for(let i=0; i<arr.length; i++){
			str = str.replace(/\{\{([A-Za-z\$\_][A-Za-z0-9]{0,})\}\}/, this.mvvm.data[ arr[i].replace(reg,"$1")] );
		}
		dom.innerHTML = str;
	}
}


/*
 *  Watcher
 * */

function MvvmWatcher(mvvm){
	this.mvvm = mvvm;
}

MvvmWatcher.prototype = {
	receive:function(data,key,newVal){
		this.mvvm.compiler.receive(data,key,newVal);
	}
}