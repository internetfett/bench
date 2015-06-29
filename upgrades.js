
var UPGRADE_TYPES={
Elite:"ept",Torpedo:"torpedo",Astromech:"amd",Turret:"turret",Missile:"missile",Crew:"crew",Cannon:"cannon",Bomb:"bomb",Title:"title",Mod:"mod",System:"system",Illicit:"illicit",Salvaged:"salvaged"
};
function Laser(u,type,fire) {
    return new Weapon(u,{
	type: type,
	name:"Laser",
	isactive:true,
	attack: fire,
	range: [1,3],
	isprimary: true
    });
}
function Bomb(sh,bdesc) {
    $.extend(this,bdesc);
    sh.upgrades.push(this);
    log("Installing bomb "+this.name);
    this.isactive=true;
    this.unit=sh;
    sh.bombs.push(this);
    this.exploded=false;
    if (this.init != undefined) this.init(sh);
}
Bomb.prototype = {
    isWeapon: function() { return false; },
    isBomb: function() { return true; },
    toString: function() {
	var a,b,str="";
	var c="";
	if (!this.isactive) c="class='inactive'"
	a="<td><code class='"+this.type+" upgrades'></code></td>"; 
	b="<td class='tdstat'>"+this.name+"</td>";
	if (this.unit.team==1)  
	    return "<tr "+c+">"+b+a+"</tr>"; 
	else return "<tr "+c+">"+a+b+"</tr>";
    },
    getrangeallunits: function () { 
	var range=[[],[],[],[],[]],i;
	for (i=0; i<squadron.length; i++) {
	    var sh=squadron[i];
	    var k=this.getrange(sh);
	    if (k>0) range[k].push({unit:i});
	};
	return range;
    },
    getbomblocation: function() {
	return this.unit.getpathmatrix(this.unit.m.clone().add(MR(180,0,0)),"F1");
    },
    getrange: function(sh) { 
	var ro=this.getOutlinePoints(this.m);
	var rsh = sh.getOutlinePoints(sh.m);
	var min=90001;
	var i,j;
	var mini,minj;
	for (i=0; i<ro.length; i++) {
	    for (j=0; j<4; j++) {
		var d=dist(rsh[j],ro[i]);
		if (d<min) min=d
	    }
	}
	if (min>90000) return 4;
	if (min<=10000) return 1; 
	if (min<=40000) return 2;
	return 3;
    },
    resolveactionmove: function(moves,cleanup) {
	var i;
	this.pos=[];
	var ready=false;
	var resolve=function(m,k,f) {
	    for (i=0; i<moves.length; i++) this.pos[i].remove();
	    this.m=m;
	    f(this,k);
	}.bind(this);
	for (i=0; i<moves.length; i++) {
	    this.pos[i]=this.getOutline(moves[i]).attr({fill:"rgba(80,80,80,0.7)"});
	    (function(k) {
		this.pos[k].hover(function() { this.pos[k].attr({stroke:this.unit.color,strokeWidth:"4px"})}.bind(this),
				     function() { this.pos[k].attr({strokeWidth:"0px"})}.bind(this));
		
		this.pos[k].click(function() 
				  { resolve(moves[k],k,cleanup); });}.bind(this)
	    )(i);
	}
    },
    drop: function(m) {
	log("["+this.unit.name+"] dropped "+this.name);
	this.img=s.image("png/"+this.img,-10,-8,20,16);
	this.isactive=false;
	this.m=m
	this.outline=this.getOutline(new Snap.matrix())
	    .attr({display:"block",stroke:halftone(this.unit.color),strokeWidth:2});
	this.g=s.group(this.outline,this.img);
	this.g.hover(
	    function () { 
		var bbox=this.g.getBBox();
		var p=$("#playmat").position();
		var x=p.left+bbox.x*$("#playmat").width()/900;
		var y=p.top+(bbox.y-20)*$("#playmat").height()/900;
		$(".info").css({left:x,top:y}).html(this.name).appendTo("body").show();
	    }.bind(this),
	    function() { $(".info").hide(); 
		       }.bind(this));
	this.g.transform(this.m);
	this.g.appendTo(s);
	BOMBS.push(this);	 
    },
    getOutlinePoints: function(m) {
	var w=10;
	var p1=transformPoint(m,{x:-w,y:-w});
	var p2=transformPoint(m,{x:w,y:-w});
	var p3=transformPoint(m,{x:w,y:w});
	var p4=transformPoint(m,{x:-w,y:w});	
	this.op=[p1,p2,p3,p4];
	return this.op;
    },
    getOutline: function(m) {
	var p=this.getOutlinePoints(m);
	var pa=s.path("M "+p[0].x+" "+p[0].y+" L "+p[1].x+" "+p[1].y+" "+p[2].x+" "+p[2].y+" "+p[3].x+" "+p[3].y+" Z");
	pa.appendTo(s);
	return pa;
    },
    explode: function() {
	this.exploded=true;
	log("["+this.name+"] exploded");
	SOUNDS[this.snd].play();
	this.g.remove();
    }
}
function Weapon(sh,wdesc) {
    this.isprimary=false;
    $.extend(this,wdesc);
    sh.upgrades.push(this);
    log("Installing weapon "+this.name+" ["+this.type+"]");
    this.isactive=true;
    this.unit=sh;
    sh.weapons.push(this);
    if (this.init != undefined) this.init(sh);
}
Weapon.prototype = {
    isBomb: function() { return false; },
    isWeapon: function() { return true; },
    toString: function() {
	var a,b,str="";
	var c="";
	if (!this.isactive) c="class='inactive'"
	else {
	    var i,r=this.getrangeallunits();
	    for (i=0; i<r.length; i++) if (r[i].team!=this.unit.team) break;
	    if (i==r.length) c="class='nofire'"
	}
	for (var i=0; i<squadron.length; i++) if (squadron[i]==this.unit) break;
	a="<td class='statfire'";
	a+=" onclick='if (!squadron["+i+"].dead) squadron["+i+"].togglehitsector(\""+this.name.replace(/\'/g,"&#39;")+"\")'";
	a+=">"+this.getattack()+"<span class='symbols'>"+A[this.type.toUpperCase()].key+"</span></td>";
	b="<td class='tdstat'>"+this.name.replace(/\'/g,"&#39;")+" <span style='font-size:x-small'>";
	if ((typeof this.getrequirements()!="undefined")) {
	    if ("Target".match(this.getrequirements())) b+="<code class='symbols'>"+A["TARGET"].key+"</code>"
	    if ("Focus".match(this.getrequirements())) b+=(this.getrequirements().length>5?"/":"")+"<code class='symbols'>"+A["FOCUS"].key+"</code>"
	}
	b+="["+this.range[0]+"-"+this.range[1]+"]</span></td>";
	if (this.unit.team==1)  
	    return "<tr "+c+">"+b+a+"</tr>"; 
	else return "<tr "+c+">"+a+b+"</tr>";
    },
    getrequirements: function() {
	return this.requires;
    },
    getattack: function() {
	return this.attack;
    },
    isTurret: function() {
	return this.type=="Turret";
    },
    isinrange: function(r) {
	return (r>=this.range[0]&&r<=this.range[1]);
    },
    modifydamagegiven: function(ch) { return ch; },
    modifydamageassigned: function(ch,t) { return ch; },
    canfire: function(sh) {
	if (!this.isactive) return false;
	if (this.unit.checkcollision(sh)) return false;
	if (typeof this.getrequirements()!="undefined") {
	    var s="Target";
	    if (s.match(this.getrequirements())&&this.unit.canusetarget(sh))
		return true;
	    s="Focus";
	    if (s.match(this.getrequirements())&&this.unit.canusefocus(sh)) return true;
	    return false;
	}
	return true;
    },
    getattackreroll: function(sh) {
	return 0;
    },
    modifyattackroll: function(n,sh) {
	return n;
    },
    getattackbonus: function(sh) {
	if (this.isprimary) {
	    var r=this.getrange(sh);
	    if (r==1) {
		log(this.unit.name+" +1 attack for range 1");
		return 1;
	    }
	}
	return 0;
    },

    declareattack: function(sh) { 
	if (typeof this.getrequirements()!="undefined") {
	    var s="Target";
	    var u="Focus";
	    if (s.match(this.getrequirements())&&this.unit.canusetarget(sh)) 
		this.unit.removetarget(sh);
	    else if (u.match(this.getrequirements())&&this.unit.canusefocus(sh)) 
		this.unit.removefocustoken();
	    this.unit.show();
	}
    },
    getdefensebonus: function(sh) {
	if (this.isprimary) {
	    var r=this.getrange(sh);
	    if (r==3) {
		log(sh.name+" +1 defense for range 3 against "+this.unit.name);
		return 1;
	    }
	}
	return 0;
    },
    getrange: function(sh) {
	var i;
	if (!this.canfire(sh)) return 0;
	if (this.isTurret()||this.unit.isTurret(this)) {
	    var r=this.unit.getrange(sh);
	    if (this.isinrange(r)) return r;
	    else return 0;
	}
	for (i=this.range[0]; i<=this.range[1]; i++) {
	    if (this.unit.isinsector(this.unit.m,i,sh)) return i; 
	}
	if (this.type=="Bilaser") {
	    var m=this.unit.m.clone();
	    m.add(MR(180,0,0));
	    for (i=this.range[0]; i<=this.range[1]; i++) {
		if (this.unit.isinsector(m,i,sh)) log(sh.name+" in range "+i);
		if (this.unit.isinsector(m,i,sh)) {
		    return i;
		} 
	    }
	}
	return 0;
    },
    endattack: function(c,h) {
	if (this.type.match("Torpedo|Missile")) {
	    this.isactive=false;
	    log("["+this.name.replace(/\'/g,"&#39;")+"] inactive");
	}
    },
    getrangeallunits: function() {
	var i;
	var r=[];
	for (i=0; i<squadron.length; i++) {
	    var s=squadron[i];
	    if (this.getrange(s)>0) r.push(s);
	}
	return r;
    }
};
function Upgrade(sh,i) {
    $.extend(this,UPGRADES[i]);
    sh.upgrades.push(this);
    log("Installing upgrade "+this.name.replace(/\'/g,"&#39;")+" ["+this.type+"]");
    this.isactive=true;
    this.unit=sh;
    if (this.init != undefined) this.init(sh);
}
function Upgradefromname(sh,name) {
    var i;
    for (i=0; i<UPGRADES.length; i++) {
	if (UPGRADES[i].name==name) {
	    var upg=UPGRADES[i];
	    if (upg.type=="Bomb") return new Bomb(sh,upg);
	    if (typeof upg.isWeapon != "undefined") 
		if (upg.isWeapon()) return new Weapon(sh,upg);
	        else return new Upgrade(sh,i);
	    if (upg.type.match("Turretlaser|Bilaser|Laser|Torpedo|Cannon|Missile|Turret")||upg.isweapon==true) return new Weapon(sh,upg);
	    return new Upgrade(sh,i);
	}
    }
    console.log("Could not find upgrade "+name);
}
Upgrade.prototype = {
    toString: function() {
	var a,b,str="";
	var c="";
	if (!this.isactive) c="class='inactive'"
	a="<td><code class='"+this.type+" upgrades'></code></td>"; 
	b="<td class='tdstat'>"+this.name.replace(/\'/g,"&#39;")+"</td>";
	if (this.unit.team==1)  
	    return "<tr "+c+">"+b+a+"</tr>"; 
	else return "<tr "+c+">"+a+b+"</tr>";
    },
    isWeapon: function() { return false; },
    isBomb: function() { return false; }
}

var rebelonly=function(p) {
    var i;
    for (i=0; i<PILOTS.length; i++) 
	if (p==PILOTS[i].name&&PILOTS[i].faction=="REBEL") return true;
    return false;
}
var empireonly=function(p) {
    var i;
    for (i=0; i<PILOTS.length; i++) 
	if (p==PILOTS[i].name&&PILOTS[i].faction=="EMPIRE") return true;
    return false;
}
var UPGRADES= [
    {
        name: "Ion Cannon Turret",
        type: "Turret",
	firesnd:"falcon_fire",
        points: 5,
        attack: 3,
	done:true,
	modifydamageassigned: function(ch,target) {
	    if (ch>0) {
		ch=1;
		log("["+this.name+"] 1<p class='hit'></p> + 1 ion token assigned to "+target.name);
		target.addiontoken();
	    }
	    return ch;
	},
        range: [1,2],
    },
    {
        name: "Proton Torpedoes",
	requires: "Target",
        type: "Torpedo",
	firesnd:"missile",
        points: 4,
	done:true,
        attack: 4,
	init: function(sh) {
	    sh.addattackmoda(this,function(m,n) {
		if (sh.weapons[sh.activeweapon]==this) return true;
		return false;
	    }.bind(this),function(m,n) {
		var f=Math.floor(m/100)%10;
		if (f>0) {
		    log("[Proton Torpedoes] 1 <p class='focus'></p> -> 1 <p class='critical'></p>");
		    return m-90;
		}
		return m;
	    }.bind(this),false,"focus");
	},        
        range: [2,3],
    },
    {
        name: "R2 Astromech",
	done:true,
        install: function(sh) {
	    var i;
	    sh.gdr2=sh.getdial;
	    sh.getdial=function() {
		var m=sh.gdr2();
		var n=[];
		for (var i=0; i<m.length; i++) {
		    var s=P[m[i].move].speed;
		    var d=m[i].difficulty;
		    if (s==1||s==2) d="GREEN";
		    n.push({ move:m[i].move,difficulty:d});
		}
		return n;
	    }.bind(sh);
	    log("["+this.name+"] 1, 2 speed maneuvers of "+sh.name+" are green");
	},
	uninstall: function(sh) {
	    sh.getdial=sh.gdr2;
	    log("["+this.name+"] uninstalling effect");
	},
        type: "Astromech",
        points: 1,
    },
    {
        name: "R2-D2",
	done:true,
        init: function(sh) {
	    var hd=sh.handledifficulty;
	    sh.handledifficulty=function(d) {
		hd.call(this,d);
		if (d=="GREEN"&&this.shield<this.ship.shield){ 
		    this.shield++;
		    log("[R2-D2] "+this.name+" recovers 1 shield");
		}
	    }
	},
        unique: true,
        type: "Astromech",
        points: 4,
    },
    {
        name: "R2-F2",
        done:true,
	candoaction: function() { return true; },
	action: function() {
	    var ga=this.unit.getagility;
	    var er=this.unit.endround;
	    log("[R2-F2] +1 agility for "+this.unit.name+" until end of round");
	    this.unit.getagility=function() {
		return ga.call(this)+1;
	    };
	    this.unit.endround=function() {
		this.unit.getagility=ga;
		this.unit.endround=er;
		er.call(this);
	    };
	    this.unit.showstats();
	    this.endaction();
	    return true;
	},
        unique: true,
        type: "Astromech",
        points: 3,
    },
    {
        name: "R5-D8",
        
        unique: true,
        type: "Astromech",
        points: 3,
    },
    {
        name: "R5-K6",
        init: function(sh) {
	    var rtt=sh.removetarget;
	    sh.removetarget=function(t) {
		rtt.call(this,t);
		var r=Math.floor(Math.random()*7);
		var roll=FACE[DEFENSEDICE[r]];
		if (roll=="evade") {
		    this.addtarget(t);
		    log("[R5-K6] target lock on "+t.name);
		    record(this.id,"TT"+t.id);
		}
	    }
	},
	done:true,
        unique: true,
        type: "Astromech",
        points: 2,
    },
    {
        name: "R5 Astromech",
        
        type: "Astromech",
        points: 1,
    },
    {
        name: "Determination",
        
        type: "Elite",
        points: 1,
    },
    {
        name: "Swarm Tactics",
        type: "Elite",
        points: 2,
	done:true,
	init: function(sh) {
	    sh.begincombatphase= function() {
		if (sh.dead) return;
		waitingforaction.add(function() {
		    var p=sh.selectnearbyunits(1,function(a,b) { return a.team==b.team&&a!=b; });
		    if (p.length>0) {
			log("<b>["+this.name+"] sets a pilot skill to the skill of "+sh.name+"</b>");
			sh.resolveactionselection(p,function(k) {
			    log(p[k].name+" has "+sh.skill+" pilot skill");
			    p[k].oldskill=p[k].skill;
			    log("old skill :"+p[k].oldskill);
			    p[k].skill=sh.skill;
			    filltabskill();
			    p[k].show();
			    var ecp=p[k].endcombatphase;
			    p[k].endcombatphase=function() {
				ecp.call(this)
				this.skill=this.oldskill;
				log(this.name+" has "+this.skill+" pilot skill");
				squadron.sort(function(a,b) {return b.skill-a.skill;});
				filltabskill();
				this.show();
			    }.bind(p[k]);
			    nextstep();
			}.bind(sh));
		    } else nextstep();
		}.bind(this));
	    }
	}
    },
    {
        name: "Squad Leader",
        unique: true,
	done:true,
        type: "Elite",
        points: 2,
	candoaction: function() {  
	    var p=this.unit.selectnearbyunits(2,function(t,s) { return t.team==s.team&&s!=t&&s.skill<t.skill&&s.candoaction();});
	    return (p.length>0);
	},
	action: function() {
	    var unit=this.unit;
	    var p=this.unit.selectnearbyunits(2,function(t,s) { return t.team==s.team&&s!=t&&s.skill<t.skill&&s.candoaction();});
	    this.unit.resolveactionselection(p,function(k) {
		p[k].select();
		unit.unselect();
		p[k].freeaction(function() { unit.endaction(); });
	    });
	},
    },
    {
        name: "Expert Handling",
	candoaction: function() { return true; },
	action: function() {
	    if (this.unit.shipactionList.indexOf("ROLL")==-1) this.unit.addstress();
	    this.unit.resolveroll();
	    if (this.unit.istargeted.length>0) {
		waitingforaction.add(function() {
		    log("<b>["+this.name+"] remove 1 target lock from "+this.unit.name+"</b>");
		    this.unit.resolveactionselection(this.unit.istargeted,function(k) {
			var unit=this.istargeted[k];
			unit.removetarget(this);
			nextstep();
		    }.bind(this.unit));
		}.bind(this));
	    }
	},        
        type: "Elite",
	done:true,
        points: 2,
    },
    {
        name: "Marksmanship",
	candoaction: function() { return true; },
	action: function() {
	    this.unit.addattackmoda(this,function(m,n) {
		return true;
	    }.bind(this.unit),function(m,n) {
		var f=Math.floor(m/100);
		log("[Marksmanship] "+f+" <code class='xfocustoken'></code> -> 1 <code class='critical'></code>"+(f>1?"+ "+(f-1)+"<code class='hit'></code>":""));
		if (f>1) return m-100*f+10+(f-1); else return m-90;
	    },false,"focus");
	    this.unit.endaction();
	},
        done:true,
        type: "Elite",
        points: 3,
    },
    {
        name: "Concussion Missiles",
	requires:"Target",
        type: "Missile",
	firesnd:"missile",
        points: 4,
        attack: 4,
        range: [2,3],
    },
    {
        name: "Cluster Missiles",
        type: "Missile",
	firesnd:"missile",
	requires:"Target",
        points: 4,
        attack: 3,
        range: [1,2],
    },
    {
        name: "Daredevil",
	done:true,
        candoaction: function() { return true; },
	action: function() {
	    log("<b>["+this.name+"] select maneuver to perform</b>");
	    this.unit.resolveactionmove(
		[this.unit.getpathmatrix(this.unit.m.clone(),"TL1"),
		 this.unit.getpathmatrix(this.unit.m.clone(),"TR1")],
		function(t) { 
		    t.addstress(); 
		    if (t.shipactionList.indexOf("BOOST")==-1) {
			log("[Daredevil] "+t.name+" no boost -> 2 rolls for damage");
			for (var i=0; i<2; i++) {
			    var r=Math.floor(Math.random()*7);
			    var roll=FACE[ATTACKDICE[r]];
			    if (roll=="hit") { t.resolvehit(1); t.checkdead(); }
			    else if (roll=="critical") { 
				t.resolvecritical(1);
				t.checkdead();
			    }
			}
		    }
		    t.endaction();
		},true);
	},
        type: "Elite",
        points: 3,
    },
    {
        name: "Elusiveness",
        
        type: "Elite",
        points:2,
    },
    {
        name: "Homing Missiles",
	requires:"Target",
        type: "Missile",
	firesnd:"missile",
        attack: 4,
        range: [2,3],
	done:true,
	init: function(sh) {
	    var ra=sh.resolveattack;
	    var wp=this;
	    sh.resolveattack=function(w,targetunit) {
		if (this.weapons[w]==wp) {
		    this.cufhm=targetunit.canusefocus;
		    log("[Homing Missile] "+targetunit.name+" cannot use focus");
		    targetunit.canusefocus=function() { return false; };
		}
		ra.call(this,w,targetunit);
	    };
	    var ea=this.endattack;
	    this.endattack=function(c,h) {
		ea.call(this,c,h);
		targetunit.canusefocus=this.unit.cufhm;
	    }
	},
        points: 5,
    },
    {
        name: "Push the Limit",
	init: function(sh) {
	    var ea=sh.endaction;
	    sh.r=-1;
	    //if (sh.endaction==Unit.prototype.endaction) log("SAME");
	    var ptl=this;
	    //log("INSTALLING PTL");
	    sh.endaction= function() {
			log("[Push the Limit] trying..."+this.r);
		if (this.r!=round) {
		    this.r=round;
		    if (this.candoaction()) {
		    waitingforaction.add(function() {
			log("[Push the Limit] select an action or empty to cancel");
			this.freeaction(function() { 
			    if (this.action>-1) { 
				this.r=round; this.addstress();
			    } else  this.r=-1; 
			    nextstep(); 
			}.bind(this));
		    }.bind(this));
		    }
		}
		ea.call(this);
	    };
	},
	done:true,
        type: "Elite",
        points: 3,
    },
    {
        name: "Deadeye",
        init: function(sh) {
	    var gr=Weapon.prototype.getrequirements;
	    Weapon.prototype.getrequirements=function() {
		var g=gr.call(this);
		if (this.unit==sh&&g=="Target") return "Target|Focus";
		return g;
	    }
	},
	done:true,
        type: "Elite",
        points: 1,
    },
    {
        name: "Expose",
        candoaction: function() { return true; },
	action: function() {
	    var ga=this.unit.getagility;
	    var w=this.unit.weapons[0];
	    var gat=w.getattack;
	    var endround=this.unit.endround;
	    log("["+this.name+"] -1 agility, +1 primary attack until end of turn");
	    this.unit.getagility=function() {
		var a=ga.call(this)-1;
		if (a>=0) return a; else return 0;
	    };
	    w.getattack=function() {
		return gat.call(w)+1;
	    };
	    this.unit.endround=function() {
		this.getagility=ga;
		w.getattack=gat;
		this.endround=endround;
	    }
	    this.unit.showstats();
	    this.unit.endaction();
	},
	done:true,
        type: "Elite",
        points: 4,
    },
    {
        name: "Gunner",
	done:true,
        init: function(sh) {
	    var ea=sh.endattack;
	    sh.endattack=function(c,h) {
		ea.call(this,c,h);
		if ((c+h==0)&&this.hasfired<2) {
		    log("[Gunner] "+this.name+" attacks again with primary weapon");
		    this.selecttargetforattack(0); 
		} 
	    };
	},
        type: "Crew",
        points: 5,
    },
    {
        name: "Ion Cannon",
        type: "Cannon",
	firesnd:"slave_fire",
	done:true,
	modifydamageassigned: function(ch,target) {
	    if (ch>0) {
		ch=1;
		log("["+this.name+"] 1<p class='hit'></p> + 1 ion token assigned to "+target.name);
		target.addiontoken();
	    }
	    return ch;
	},
        points: 3,
        attack: 3,
        range: [1,3],
    },
    {
        name: "Heavy Laser Cannon",
        type: "Cannon",
	firesnd:"slave_fire",
	done:true,
	modifydamagegiven: function(ch) {
	    if (ch>10) {
		var c=Math.floor(ch/10);
		var h=ch-10*c;
		log("["+this.name+"] "+c+"<p class='critical'></p>-> "+c+"<p class='hit'></p>");
		ch=c+h;
	    }
	    return ch;
	},
        points: 7,
        attack: 4,
        range: [2,3],
    },
    {
        name: "Seismic Charges",
	done:true,
	img:"seismic.png",
	snd:"explode",
        explode: function() {
	    if (phase==ACTIVATION_PHASE&&!this.exploded) {
		var r=this.getrangeallunits();
		var i;
		for (i=0; i<r[1].length; i++) 
		    squadron[r[1][i].unit].resolvehit(1);
		BOMBS.splice(BOMBS.indexOf(this),1);
		Bomb.prototype.explode.call(this);
	    }
	},
        type: "Bomb",
        points: 2,
    },
    {
        name: "Mercenary Copilot",
        
        type: "Crew",
        points: 2,
    },
    {
        name: "Assault Missiles",
        type: "Missile",
	requires:"Target",
	firesnd:"missile",
	done:true,
	modifydamageassigned: function(ch,t) {
	    if (ch>0) {
		log("["+this.name+"] 1 damage assigned to all units at range 1 of "+t.name);
		var r=t.getrangeallunits();
		for (var i=0; i<r[1].length; i++) {
		    squadron[r[1][i].unit].resolvehit(1);
		}
	    }
	    return ch;
	},
        points: 5,
        attack: 4,
        range: [2,3],
    },
    {
        name: "Veteran Instincts",
	done:true,
        install: function(sh) {
	    sh.skill+=2;
	},
	uninstall: function(sh) {
	    sh.skill-=2;
	},
        type: "Elite",
        points: 1,
    },
    {
        name: "Proximity Mines",
        
        type: "Bomb",
        points: 3,
    },
    {
        name: "Weapons Engineer",
        
        type: "Crew",
        points: 3,
    },
    {
        name: "Draw Their Fire",
        
        type: "Elite",
        points: 1,
    },
    {
        name: "Luke Skywalker",
        faction:"REBEL",
        unique: true,
	done:true,
        init: function(sh) {
	    var ea=sh.endattack;
	    sh.endattack=function(c,h) {
		ea.call(this,c,h);
		if ((c+h==0)&&this.hasfired<2) {
		    log("[Luke Skywalker] "+this.name+" attacks again with primary weapon");
		    this.selecttargetforattack(0);
		} 
	    };
	    sh.addattackmoda(this,function(m,n) {
		if (this.hasfired==2) return true;
		return false;
	    }.bind(sh),function(m,n) {
		if (m>100) return m-99; else return m;
	    },false,"focus");
	},
        type: "Crew",
        points: 7,
    },
    {
        name: "Nien Nunb",
	faction:"REBEL",
	done:true,
        install: function(sh) {
	    var i;
	    sh.getdial=function() {
		var m=Unit.prototype.getdial.call(this);
		var n=[];
		for (var i=0; i<m.length; i++) {
		    var move=m[i].move;
		    var d=m[i].difficulty;
		    if (move.match("F1|F2|F3|F4|F5")) d="GREEN";
		    n.push({move:move,difficulty:d});
		}
		return n;
	    }.bind(sh);
	},
	uninstall:function(sh) {
	    sh.getdial=Unit.prototype.getdial;
	},
        unique: true,
        type: "Crew",
        points: 1,
    },
    {
        name: "Chewbacca",
        faction:"REBEL",
        unique: true,
        type: "Crew",
        points: 4,
    },
    {
        name: "Advanced Proton Torpedoes",
	requires:"Target",
        type: "Torpedo",
	firesnd:"missile",
        attack: 5,
	done:true,
        range: [1,1],
	init: function(sh) {
	    sh.addattackmoda(this,function(m,n) {
		if (sh.weapons[sh.activeweapon]==this) return true;
		return false;
	    }.bind(this),function(m,n) {
		var r=m%10+(Math.floor(m/10)%10)+(Math.floor(m/100)%10);
		if (n-r>0) {
		    log("[Advanced Proton Torpedoes] change "+(n-r)+" blanks by focus");
		    if (n-r<3) m+=(n-r)*100; else m+=300;
		}
		return m;
	    }.bind(this),false,"blank");
	},        
        points: 6,
    },
    {
        name: "Autoblaster",
        type: "Cannon",
	done:true,
	firesnd:"slave_fire",
        attack: 3,
	init: function(sh) {
	    var ch=Unit.prototype.cancelhit;
	    Unit.prototype.cancelhit=function(h,e,u) {
		if (u.weapons[u.activeweapon].name=="Autoblaster Turret") {
		    log("[Autoblaster Turret] Hits cannot be cancelled by defense dice");
		    return h;
		}
		return ch.call(this,h,e,u);
	    };
	},
        range: [1,1],
        points: 5,
    },
    {
        name: "Fire-Control System",
	done:true,
        init: function(sh) {
	    var fcs=sh.cleanupattack;
	    sh.cleanupattack=function() {
		log("[Fire-Control System] free target lock on "+targetunit.name);
		this.addtarget(targetunit);
		fcs.call(this);
	    };
	},
        type: "System",
        points: 2,
    },
    {
        name: "Blaster Turret",
        type: "Turret",
	done:true,
	firesnd:"falcon_fire",
	requires:"Focus",
        points: 4,
        attack: 3,
        range: [1,2],
    },
    {
        name: "Recon Specialist",
        init: function(sh) {
	    sh.addfocus=function() {
		sh.addfocustoken();
		return Unit.prototype.addfocus.call(this);
	    }
	},
	done:true,
        type: "Crew",
        points: 3,
    },
    {
        name: "Saboteur",
        type: "Crew",
        points: 2,
    },
    {
        name: "Intelligence Agent",
        
        type: "Crew",
        points: 1,
    },
    {
        name: "Proton Bombs",
        done:true,
	snd:"explode",
	img:"proton.png",
        explode: function() {
	    if (phase==ACTIVATION_PHASE&&!this.exploded) {
		var r=this.getrangeallunits();
		var i;
		for (i=0; i<r[1].length; i++) 
		    squadron[r[1][i].unit].applycritical(1);
		BOMBS.splice(BOMBS.indexOf(this),1);
		Bomb.prototype.explode.call(this);
	    }
	},
        type: "Bomb",
        points: 5,
    },
    {
        name: "Adrenaline Rush",
        
        type: "Elite",
        points: 1,
    },
    {
        name: "Advanced Sensors",
	done:true,
        init: function(sh) {
	    var as=sh.timeforaction;
	    var upg=this;
	    sh.timeforaction=function() {
		if (!this.isactive) this.timeforaction=as;
		log("[Advanced Sensors] action before maneuver for "+this.name);
		return (this==activeunit&&!this.actiondone&&phase==ACTIVATION_PHASE);
	    }
	},
        type: "System",
        points: 3,
    },
    {
        name: "Sensor Jammer",
        
        type: "System",
        points: 4,
    },
    {
        name: "Darth Vader",
        faction:"EMPIRE",
        unique: true,
        
        type: "Crew",
        points: 3,
    },
    {
        name: "Rebel Captive",
	faction:"EMPIRE",
	done:true,
        init: function(sh) {
	    var ih=sh.ishit;
	    sh.rebelcaptive=0;
	    sh.ishit=function(t) {
		if (this.rebelcaptive!=round) {//First attack this turn
		    log("[Rebel Captive] +1 stress for "+t.name);
		    t.addstress();
		    this.rebelcaptive=round;
		}
		return ih.call(this,t);
	    }.bind(sh);
	},
        unique: true,
        
        type: "Crew",
        points: 3,
    },
    {
        name: "Flight Instructor",
        init: function(sh) {
	    sh.adddefensererolld(
		this,
		["focus"],
		function() { if (activeunit.skill<=2) return 2; return 1; },
		function(w,attacker) {
		    log("[Flight Instructor] +"+(activeunit.skill<=2?2:1)+" reroll(s)");
		    return true;
		},
		false
	    )
	},
	done:true,
        type: "Crew",
        points: 4,
    },
    {
        name: "Navigator",
        init: function(sh) {
	    var cm=sh.completemaneuver;
            sh.completemaneuver= function(dial,realdial,difficulty) {
		var bearing=realdial.replace(/\d/,'');
		var gd=this.getdial();
		var p=[];
		var q=[];
		q.push(realdial);
		p.push(this.getpathmatrix(this.m.clone(),realdial));
		for (i=0; i<gd.length; i++) 
		    if (gd[i].move.match(bearing)&&gd[i].move!=realdial&&(gd[i].difficulty!=RED||this.stress==0)) { 
			p.push(this.getpathmatrix(this.m.clone(),gd[i].move));
			q.push(gd[i].move);
		    }
		if (p.length>1) {
		    log("<b>[Navigator] choose maneuver of bearing "+bearing+"</b>");
		    this.resolveactionmove(p,
		    function(t,k) {
			cm.call(t,q[k],q[k],difficulty);
		    },false,true);
		} else cm.call(this,dial,realdial,difficulty);
	    }
	},
	done:true,
        type: "Crew",
        points: 3,
    },
    {
        name: "Opportunist",
	done:true,
        init: function(sh) {
	    var gas=sh.getattackstrength;
	    sh.getattackstrength=function(w,t) {
		var a=gas.call(this,w,t);
		if (t.focus+t.evade==0) {
		    a=a+1;
		    this.addstress();
		    log("[Opportunist] +1 attack against "+t.name+", 1 stress more");
		}
		return a;
	    };
	},
        type: "Elite",
        points: 4,
    },
    {
        name: "Ion Pulse Missiles",
	requires:"Target",
        type: "Missile",
	firesnd:"missile",
	done:true,
	modifydamageassigned: function(ch,t) {
	    if (ch>0) {
		log("["+this.name+"] 2<p class='hit'></p> + 1 ion token assigned by "+t.name);
		ch=2;
		t.ionized+=2;
	    }
	    return ch;
	},
        points: 3,
        attack: 3,
        range: [2,3],
    },
    {
        name: "Wingman",
	done:true,
        init: function(sh) {
	    var bcp=sh.begincombatphase;
	    sh.begincombatphase= function() {
		if (this.dead) return;
		bcp.call(this);
		waitingforaction.add(function() {
		    var p=this.selectnearbyunits(1,function(a,b) { return a.team==b.team&&a!=b&&b.stress>0; });
		    if (p.length>0) {
			log("<b>[Wingman] select a pilot with stress to remove.</b>");
			this.resolveactionselection(p,function(k) {
			    p[k].removestresstoken();
			    nextstep();
			});
		    } else nextstep();
		}.bind(this)); 
	    }
	},
        type: "Elite",
        points: 2,
    },
    {
        name: "Decoy",
        init: function(sh) {
	    sh.begincombatphase= function() {
		if (this.dead) return;
		waitingforaction.add(function() {
		var p=this.selectnearbyunits(2,function(a,b) { return a.team==b.team&&a!=b; });
		    p.push(this);
		    if (p.length>1) {
			log("<b>[Decoy] select a pilot skill to exchange with "+this.name+" (or self to cancel)</b>");
			this.resolveactionselection(p,function(k) {
			    if (p[k]!=this) {
				var s=this.skill;
				this.skill=p[k].skill;
				p[k].skill=s;
				filltabskill();
				p[k].show();
				this.show();
			    }
			    nextstep();
			}.bind(this));
		    } else nextstep();
		}.bind(this));
	    }
	},
	done:true,
        type: "Elite",
        points: 2,
    },
    {
        name: "Outmaneuver",
	done:true,
        init: function(sh) {
	    sh.raoutmaneuver=sh.resolveattack;
	    sh.resolveattack=function(w,targetunit) {
		targetunit.tagility=targetunit.agility;
		if (this.isinsector(this.m,3,targetunit)
		    &&!targetunit.isinsector(targetunit.m,3,sh)) {
		    log("[Outmaneuver] -1 agility for "+targetunit.name);
		    targetunit.agility--;
		}
		this.raoutmaneuver.call(this,w,targetunit);
	    }.bind(sh);
	    sh.eaoutmaneuver=sh.endattack;
	    sh.endattack=function(c,h) {
		targetunit.agility=targetunit.tagility;
		this.eaoutmaneuver.call(this,c,h);
	    }.bind(sh);
	},
        type: "Elite",
        points: 3,
    },
    {
        name: "Predator",
	done:true,
        init: function(sh) {
	    sh.addattackrerolla(
		this,
		["blank","focus"],
		function() { if (targetunit.skill<=2) return 2; return 1; },
		function(w,defender) {
		    log("[Predator] "+(targetunit.skill<=2?2:1)+" reroll(s)");
		    return true;
		},
		false
	    )
	},
        type: "Elite",
        points: 3,
    },
    {
        name: "Flechette Torpedoes",
	requires:"Target",
        type: "Torpedo",
	firesnd:"missile",
	done:true,
	endattack: function(c,h) {
	    if (targetunit.hull<=4) targetunit.addstress();
	    this.isactive=false;
	},
        points: 2,
        attack: 3,
        range: [2,3],
    },
    {
        name: "R7 Astromech",
              
        type: "Astromech",
        points: 2,
    },
    {
        name: "R7-T1",
	candoaction: function() { return true; },	    
	action: function() {
		//log("R7-T1 preactivated");
		var p=this.unit.selectnearbyunits(2,function(a,b) { return a.team!=b.team; });
		//log("R7-T1 activated");
		if (p.length>0) {
		    p.push(this.unit);
		    log("<b>[R7-T1] acquire target lock on target enemy ship (self to ignore)</b>");
		    this.unit.resolveactionselection(p,function(k) {
			if (p[k]!=this) { 
			    if (p[k].gethitsector(this)<=3) this.addtarget(p[k]);
			    this.resolveboost();
			} else this.endaction();
		    });
		} else this.unit.endaction();
	},
	done:true,
        unique: true,
        type: "Astromech",
        points: 3,
    },
    {
        name: "Tactician",
        type: "Crew",
        points: 2,
	done:true,
        init: function(sh) {
	    var tac = sh.endattack;
	    sh.endattack=function(c,h) {
		tac.call(this);
		if (this.isinsector(this.m,2,targetunit)) {
		    targetunit.addstress();
		    log("[Tactician] +1 stress for "+targetunit.name);
		}
	    }.bind(sh);
	}
    },
    {
        name: "R2-D2",
        faction:"REBEL",
        unique: true,
        type: "Crew",
        points: 4,
        
    },
    {
        name: "C-3PO",
        unique: true,
        faction:"REBEL",
        type: "Crew",
        points: 3,
        
    },
    {
        name: "R3-A2",
	done:true,
        init: function(sh) {
	    var da=sh.declareattack;
	    sh.declareattack=function(w,target) {
		da.call(this,w,target);
		if (this.isinsector(this.m,3,target)) {
		    this.addstress();
		    log("[R3-A2] +1 stress for "+target.name+" and "+this.name);
		    target.addstress();
		}
	    }
	},
        unique: true,
        type: "Astromech",
        points: 2,
    },
    {
        name: "R2-D6",
        upgrades:["Elite"],
	noupgrades:"Elite",
	skillmin:3,
	done:true,
        unique: true,
        type: "Astromech",
        points: 1,
    },
    {
        name: "Enhanced Scopes",
	done:true,
        init: function(sh) {
	    sh.beginactivationphase=function() {
		sh.oldskill=sh.skill;
		log("[Enhanced Scopes] "+sh.name+" skill set to 0"); 
		sh.skill=0;
	    };
	    sh.endactivationphase=function() {
		sh.skill=sh.oldskill;
	    };
	},
        type: "System",
        points: 1,
    },
    {
        name: "Chardaan Refit",
        type: "Missile",
	done:true,
	isWeapon: function() { return false; },
        points: -2,
        ship: "A-Wing",
    },
    {
        name: "Proton Rockets",
        type: "Missile",
	firesnd:"missile",
	requires:"Focus",
        points: 3,
        attack: 2,
	done:true,
	getattack: function() {
	    a=this.attack;
	    if (this.unit.agility<=3) a+=this.unit.agility;
	    else a+=3;
	    log("[Proton Rockets] +"+(this.unit.agility>3?3:this.unit.agility)+" attack for agility");
	    return a;
	},
        range: [1,1],
    },
    {
        name: "Kyle Katarn",
        faction:"REBEL",
        unique: true,
	done:true,
        type: "Crew",
        points: 3,
	init: function(sh) {
	    var rst=sh.removestresstoken;
	    sh.removestresstoken=function() {
		rst.call(this);
		this.addfocustoken();
	    }.bind(sh);
	}
        
    },
    {
        name: "Jan Ors",
        faction:"REBEL",
        unique: true,
        type: "Crew",
        points: 2,
    },

    {
        name: "R4-D6",
        init: function(sh) {
	    var ch=sh.cancelhit;
	    sh.cancelhit=function(h,e,org) {
		var h=ch.call(this,h,e,org);
		if (h>=3) {
		    var d=h-2;
		    for (var i=0; i<d; i++) sh.addstress();
		    return d;
		}
		return h;
	    };
	},
	done:true,
        unique: true,
        type: "Astromech",
        points: 1,
    },
    {
        name: "R5-P9",
	done:true,
        init: function(sh) {
	    var ecp=sh.endcombatphase;
	    sh.endcombatphase=function() {
		ecp.call(this);
		if (this.shield<this.ship.shield&&this.canusefocus()) {
		    this.shield++;
		    log("[R5-P9] 1 <code class='xfocustoken'></code> -> 1 <code class='cshield'></code>");
		    this.removefocustoken();
		}
	    }.bind(sh);
	},        
        unique: true,
        type: "Astromech",
        points: 3,
    },
    {
        name: "Han Solo",
        faction:"REBEL",
        type: "Crew",
        unique: true,
        
        points: 2,
    },
    {
        name: "Leia Organa",
        faction:"REBEL",
        type: "Crew",
        unique: true,
        points: 4,
    },
    {
        name: "Targeting Coordinator",
        type: "Crew",
        limited: true,
        points: 4,
    },

    {
        name: "Lando Calrissian",
        faction:"REBEL",
        type: "Crew",
        unique: true,
        
        points: 3,
    },
    {
        name: "Mara Jade",
        faction:"EMPIRE",
        type: "Crew",
        unique: true,
	done:true,
        init: function(sh) {
	    sh.endcombatphase=function() {
		var p=this.gettargetableunits(1);
		var i;
		if (p.length>0) log("[Mara Jade] +1 stress for all enemies in range 1");
		for (i=0; i<p.length; i++) {
		    if (p[i].stress==0) p[i].addstress();
		}
	    }.bind(sh);
	},
        points: 3,
    },
    {
        name: "Fleet Officer",
        faction:"EMPIRE",
        type: "Crew",
        
        points: 3,
    },
    {
        name: "Stay On Target",
        type: "Elite",
        points: 2,
	done:true,
	init: function(sh) {
	    var cm=sh.completemaneuver;
            sh.completemaneuver= function(dial,realdial,difficulty) {
		var speed=realdial.substr(-1);
		var gd=this.getdial();
		var p=[];
		var q=[];
		q.push(realdial);
		p.push(this.getpathmatrix(this.m.clone(),realdial));
		for (i=0; i<gd.length; i++) 
		    if (gd[i].move.substr(-1)==speed&&gd[i].move!=realdial) { 
			p.push(this.getpathmatrix(this.m.clone(),gd[i].move));
			q.push(gd[i].move);
		    }
		if (p.length>1) {
		    log("<b>[Stay on target] choose maneuver of speed "+speed+"</b>");
		    this.resolveactionmove(p,
		    function(t,k) {
			cm.call(t,q[k],q[k],(k==0)?difficulty:RED);
		    },false,true);
		} else cm.call(this,dial,realdial,difficulty);
	    }
	}
    },
    {
        name: "Dash Rendar",
        faction:"REBEL",
        unique: true,
        type: "Crew",
        points: 2,
        
    },
    {
        name: "Lone Wolf",
	done:true,
	init: function(sh) {
	    sh.addattackrerolla(
		this,
		["blank"],
		function() { return 1; },
		function(w,defender) {
		    var r=this.unit.getrangeallunits();
		    for (var i=0; i<squadron.length; i++) 
			if (squadron[i].getrange(this.unit)<=2
			    &&squadron[i].team==this.unit.team) return false;
		    log("[Lone Wolf] 1 reroll");
		    return true;
		},
		false
	    )
	},
        unique: true,
        type: "Elite",
        points: 2,
    },
    {
        name: "'Leebo'",
        faction:"REBEL",
        unique: true,
	candoaction: function() { return true; },
	action: function() {
	    log("["+this.name+"] free boost and ion token");
	    this.unit.addiontoken();
	    this.unit.resolveboost();
	},
	done:true,
        type: "Crew",
        points: 2,
        
    },
    {
        name: "Ruthlessness",
        faction:"EMPIRE",
        type: "Elite",
        points: 3,
	done:true,
        init: function(sh) {
	    var ruth = sh.endattack;
	    sh.endattack=function(c,h) {
		ruth.call(this);
		var p=targetunit.selectnearbyunits(1,function(t,o) { return true; });
		if (p.length>0) {
		    this.resolveactionselection(p,function(k) {
			log("[Ruthlessness] +1 hit to "+p[k].name);
			p[k].resolvehit(1); p[k].checkdead();
		    });
		}
	    }.bind(sh);
	}
    },
    {
        name: "Intimidation",
	done:true,
        init: function(sh) {
	    var unit=this;
	    unit.ga=sh.getagility;
	    sh.getagility=function() {
		var a=unit.ga.call(this);
		if (this.team!=unit.team&&a>0&&this.iscollidingunit(this.m,unit)) {
		    log("[Intimidation] -1 agility to "+this.name);
		    return a-1;
		}
		return a;
	    }
	},
        type: "Elite",
        points: 2,
    },
    {
        name: "Ysanne Isard",
        faction:"EMPIRE",
        unique: true,
	done:true,
	init: function(sh) {
	    sh.bcpisard=sh.begincombatphase;
	    sh.begincombatphase=function() {
		this.bcpisard.call(this);
		if (this.shield==0&&this.hull<this.ship.hull&&this.candoevade()) {
		    this.addevadetoken();
		    log("[Ysanne Isard] +1 free evade");
		}
	    }.bind(sh);
	},
	done:true,
        type: "Crew",
        points: 4,
        
    },
    {
        name: "Moff Jerjerrod",
        faction:"EMPIRE",
        unique: true,
        type: "Crew",
        points: 2,
        
    },
    {
        name: "Ion Torpedoes",
	requires:"Target",
        type: "Torpedo",
	firesnd:"missile",
	done:true,
	modifydamageassigned: function(ch,t) {
	    if (ch>0) {
		log("["+this.name+"] 1 ion token for all units at range 1 of "+t.name);
		t.addiontoken();
		var r=t.getrangeallunits();
		for (var i=0; i<r[1].length; i++) {
		    squadron[r[1][i].unit].addiontoken();
		}
	    }
	    return ch;
	},
        points: 5,
        attack: 4,
        range: [2,3],
    },
    {
        name: "Bodyguard",
        faction:"SCUM",
        unique: true,
	done:true,
	init: function(sh) {
	    var bcp=sh.begincombatphase;
	    sh.begincombatphase= function() {
		bcp.call(this);
		if (this.dead) return;
		waitingforaction.add(function() {
		    var p=this.selectnearbyunits(1,function(a,b) { return a.team==b.team&&a!=b&&a.skill<b.skill; });
		    p.push(this);
		    if (p.length>1&&this.canusefocus()) {
			log("<b>["+this.name+"] increase agility of selected pilot</b>");
			this.resolveactionselection(p,function(k) {
			    if (this!=p[k]) {
				p[k].agility++;
				this.removefocustoken();
				this.show();
				var ecp=p[k].endcombatphase;
				p[k].endcombatphase=function() {
				    ecp.call(this);
				    this.agility--;
				    this.showstats();
				    p[k].endcombatphase=ecp;
				}.bind(p[k]);
			    }
			    nextstep();
			}.bind(this));
		    } else nextstep();
		}.bind(sh));
	    }
	},
        type: "Elite",
        points: 2,
        
    },
    {
        name: "Calculation",
	done:true,
        init: function(sh) {
	    sh.addattackmoda(this,function(m,n) {
		return this.canusefocus();
	    }.bind(sh),function(m,n) {
		var f=Math.floor(m/100)%10;
		if (f>0) {
		    log("[Calculation] 1 <p class='focus'></p> -> 1 <p class='critical'></p>");
		    return m-90;
		}
		return m;
	    },false,"focus");
	},   
        type: "Elite",
        points: 1,
    },
    {
        name: "Accuracy Corrector",
	init: function(sh) {
	    sh.addattackmoda(this,function(m,n) {
		return true;
	    }.bind(this),function(m,n) {
		log("[Accuracy Corrector] replace all dice by 2 <p class='hit'></p>");
		return 2;
	    }.bind(this),false,"blank");
	},                
	done:true,
        type: "System",
        points: 3,
    },
    {
        name: "Inertial Dampeners",
	done:true,
        init: function(sh) {
	    var uad=sh.updateactivationdial;
	    var upg=this;

	    sh.updateactivationdial=function() {
		var ad=uad.call(this);
		this.addactivationdial(function() { return !upg.unit.hasmoved&&upg.isactive; },
				       function() {
					   upg.unit.completemaneuver("F0","F0","WHITE");
					   upg.isactive=false;
					   upg.unit.addstress();
				       }, 
				       A["ILLICIT"].key,
				       $("<div>").attr({class:"symbols"}));
		return ad;
	    }
	},
        type: "Illicit",
        points: 1,
    },
    {
        name: "Flechette Cannon",
        type: "Cannon",
	firesnd:"slave_fire",
	done:true,
	modifydamageassigned: function(ch,t) {
	    if (ch>0) {
		ch=1;
		log("["+this.name+"] 1<p class='hit'></p> and stress token for "+t.name);
		if (t.stress==0) t.addstress();
	    }
	    return ch;
	},
        points: 2,
        attack: 3,
        range: [1,3],
    },
    {
        name: "'Mangler' Cannon",
        type: "Cannon",
	firesnd:"slave_fire",
        points: 4,
        attack: 3,
	done:true,
	modifydamagegiven: function(ch) {
	    if (ch%10>0) {
		log("["+this.name+"] "+1+"<p class='hit'></p>-> 1 <p class='critical'></p>");
		ch=ch+9;
	    }
	    return ch;
	},

        range: [1,3],
    },
    {
        name: "Dead Man's Switch",
	done:true,
        init: function(sh) {
	    var di=sh.dies;
	    sh.dies=function() {
		var i;
		var r=sh.getrangeallunits();
		di.call(this);
		log("[Dead Man's Switch] 1 damage for all units in range 1");
		for (i=0; i<r[1].length; i++) {
		    squadron[r[1][i].unit].applydamage(1);
		}
	    };
	},
        type: "Illicit",
        points: 2,
    },
    {
        name: "Feedback Array",
        type: "Illicit",
        points: 2,
    },
    {
        name: "'Hot Shot' Blaster",
	done:true,
        isWeapon: function() { return true;},
	isTurret:function() { return true;},
	endattack: function(c,h) { this.isactive=false; },
        type: "Illicit",
	firesnd:"xwing_fire",
        points: 3,
        attack: 3,
        range: [1,2],
    },
    {
        name: "Greedo",
        faction:"SCUM",
        unique: true,
        type: "Crew",
        
        points: 1,
    },
    {
        name: "Salvaged Astromech",   
        type: "Salvaged",
        points: 2,
    },
    {
        name: "Bomb Loadout",
        upgrades:["Bomb"],
	done:true,
	isWeapon: function() { return false; },
        limited: true,
        type: "Torpedo",
        points: 0,
        ship: "Y-Wing",
    },
    {
        name: "'Genius'",
        unique: true,
	done:true,
	init: function(sh) {
	    sh.candropbomb=function() {
		return phase==ACTIVATION_PHASE;
	    }
	},
        type: "Salvaged",
        points: 0,
    },
    {
        name: "Unhinged Astromech",
        type: "Salvaged",
	done:true,
        install: function(sh) {
	    var i;
	    sh.gd=sh.getdial;
	    sh.getdial=function() {
		var m=sh.gd();
		var n=[];
		for (i=0; i<m.length; i++) {
		    var d=m[i].difficulty;
		    var move=m[i].move;
		    if (move.match("F3|TL3|TR3|BL3|BR3|SR3|SR3|K3")) 
			d="GREEN";
		    n.push({move:move,difficulty:d});
		}
		return n;
	    };
	},
	uninstall:function(sh) {
	    sh.getdial=sh.gd;
	},
        points: 1,
    },
    {
        name: "R4-B11",
        unique: true,
        type: "Salvaged",
        points: 3,
    },
    {
        name: "Autoblaster Turret",
        type: "Turret",
	firesnd:"falcon_fire",
	done:true,
        points: 2,
        attack: 2,
	init: function(sh) {
	    var ch=Unit.prototype.cancelhit;
	    Unit.prototype.cancelhit=function(h,e,u) {
		if (u.weapons[u.activeweapon].name=="Autoblaster Turret") {
		    log("[Autoblaster Turret] Hits cannot be cancelled by defense dice");
		    return h;
		}
		return ch.call(this,h,e,u);
	    };
	},
        range: [1,1],
    },
    {
        name: "R4 Agromech",
	done:true,
        init: function(sh) {
	    sh.usefocusattack=function(id) {
		if (this.target==0) {
		    log("[R4 Agromech] free target lock");
		    this.addtarget(targetunit);
		    /* TODO: add target token ? */
		}
		Unit.prototype.usefocusattack.call(this,id);
	    };
	    sh.declareattack=function(wp,t) {
		var r=this.weapons[wp].getrequirements();
		if ((typeof r !="undefined")&&"Focus".match(r)&&this.canusefocus(t)) {
		    log("[R4 Agromech] free target lock");
		    this.addtarget(t);
		}
		Unit.prototype.declareattack.call(this,wp,t);
	    };
	},
        type: "Salvaged",
        points: 2,
    },
    {
        name: "K4 Security Droid",
        faction:"SCUM",
        type: "Crew",
	done:true,
        init: function(sh) {
	    sh.handledifficulty=function(d) {
		Unit.prototype.handledifficulty.call(this,d);
		if (d=="GREEN") {
		    waitingforaction.add(function() {
			var p=this.gettargetableunits(3);
		  	if (p.length>0) {
			    p.push(this);
			    log("[K4 Security Droid] select unit to target lock for "+this.name+" (self to cancel)");
			    this.resolveactionselection(p,function(k) {
				if (this!=p[k]) {
				    this.addtarget(p[k]);
				    log("["+this.name+"] lock target "+p[k].name);
				}
				nextstep();
			    }.bind(this));
			} else nextstep();
		    }.bind(this));
		}
	    }
	},
        points: 3,
    },
    {
        name: "Outlaw Tech",
        faction:"SCUM",
        limited: true,
	done:true,
        type: "Crew",
        init: function(sh) {
	    sh.handledifficulty=function(d) {
		Unit.prototype.handledifficulty(d);
		if (d=="RED") sh.addfocustoken();
	    }
	},
        points: 2,
    },
    {
        name: "Advanced Targeting Computer",
        type: "System",
        points: 5,
        ship: "TIE Advanced",
    },
    {
        name: "Stealth Device",
	type:"Mod",
	done:true,
	install:function(sh) {
	    sh.agility++;
	},
	uninstall:function(sh) {
	    sh.agility--;
	},
	init: function(sh) {
	    log("["+this.name+"] +1 agility for "+sh.name)
	    var ih=sh.ishit;
	    sh.ishit=function(t) {
		var i;
		for (i=0;i<this.upgrades.length; i++) 
		    if (this.upgrades[i].name=="Stealth Device") break;
		if (this.upgrades[i].isactive) { 
		    this.upgrades[i].isactive=false; 
		    this.agility--;
		    log("["+this.name+"] "+this.upgrades[i].name+" is hit => equipment destroyed");
		    this.show();
		}
		ih.call(this,t);
	    }.bind(sh);
	},
        points: 3,
    },
    {
        name: "Shield Upgrade",
	type:"Mod",    
	done:true,
	install: function(sh) {
	    sh.shield++;
	},
	uninstall:function(sh) {
	    sh.shield--;
	},
        points: 4,
    },
    {
        name: "Engine Upgrade",
	type:"Mod",
	done:true,
	addedaction:"Boost",
        points: 4,
    },
    {
        name: "Anti-Pursuit Lasers",
	type:"Mod",
        islarge:true,
        points: 2,
    },
    {
        name: "Targeting Computer",
	type:"Mod",
	done:true,
	addedaction:"Target",
        points: 2,
    },
    {
        name: "Hull Upgrade",
	type:"Mod",
	done:true,
        install: function(sh) {
	    sh.hull++;
	},     
	uninstall:function(sh) {
	    sh.hull--;
	},
        points: 3,
    },
    {
        name: "Munitions Failsafe",
	type:"Mod",
        
        points: 1,
    },
    {
        name: "Stygium Particle Accelerator",
	type:"Mod",
	done:true,
        init: function(sh) {
	    sh.resolvecloak=function() {
		this.focus++;
		log("[Stygium P.A.] free focus for "+this.name);
		return Unit.prototype.resolvecloak.call(this);
	    };
	    sh.resolveuncloak=function() {
		this.focus++;
		log("[Stygium P.A.] free focus for "+this.name);
		return Unit.prototype.resolveuncloak.call(this);
	    };
	},
        points: 2,
    },
    {
        name: "Advanced Cloaking Device",
	type:"Mod",
        points: 4,
        ship: "TIE Phantom",
    },
    {
        name: "B-Wing/E2",
	type:"Mod",
	done:true,
        upgrades:["Crew"],
        points: 1,
        ship: "B-Wing",

    },
    {
        name: "Countermeasures",
	type:"Mod",
        islarge:true,
        points: 3,
    },
    {
        name: "Experimental Interface",
	type:"Mod",
        unique: true,
        points: 3,
    },
    {
        name: "Tactical Jammer",
	type:"Mod",
        islarge:true,
        points: 1,
    },
    {
        name: "Autothrusters",
	type:"Mod",
        actionrequired:"Boost",
        points: 2,
	done:true,
	init: function(sh) {
	    sh.adddefensemodd(this,function(m,n) {
		if (!this.isinsector(this.m,2,activeunit)) return true;
		return false;
	    }.bind(sh),function(m,n) {
		var b=n-Math.floor(m/10)%10-m%10;
		if (b>0) {
		    log("[Autothrusters] 1 <p class='blank'></p> -> 1 <p class='evade'></p>");
		    return m+1;
		}
		return m;
	    },false," ");
	}
    },
    {
        name: "Slave I",
        type:"Title",
        unique: true,
        points: 0,
	done:true,
        ship: "Firespray-31",
	upgrades:["Torpedo"],
    },
    {
        name: "Millennium Falcon",
        type:"Title",
	done:true,
	addedaction:"Evade",
        unique: true,
        points: 1,
        ship: "YT-1300",
    },
    {
        name: "Moldy Crow",
        type:"Title",
        init: function(sh) {
	    sh.endround=function() {
		this.evade=0;
		if (this.focus>0) log("["+this.name+"] keeps focus tokens");
		this.showinfo();
	    };
	},
        unique: true,
	done:true,
        points: 3,
        ship: "HWK-290",
    },
    {
        name: "ST-321",
        type:"Title",
	done:true,
        init: function(sh) {
	    var cdt=sh.candotarget;
	    sh.candotarget=function() {
		cdt.call(this);
		return true;
	    };
	    sh.resolvetarget=function() {
		var i; var p=[];
		for (i=0; i<squadron.length; i++) 
		    if (squadron[i].team!=this.team) p.push(squadron[i]);
		if (p.length>0) {
		    log("[ST-321] can target any unit on area");
		    this.resolveactionselection(p,function(k) { 
			this.addtarget(p[k]);
			this.endaction();
		    }.bind(this));
		    return true;
		} else { return false; }
	    }
	},
        unique: true,
        points: 3,
        ship: "Lambda-Class Shuttle",
    },
    {
        name: "Royal Guard TIE",
        type:"Title",
	done:true,
        upgrades:["Mod"],
	skillmin:5,
        points: 0,
        ship: "TIE Interceptor",
    },
    {
        name: "A-Wing Test Pilot",
        type:"Title",
	done:true,
        upgrades:["Elite"],
	skillmin:2,
        points: 0,
        ship: "A-Wing",
        special_case: "A-Wing Test Pilot",
    },
    {
        name: "Outrider",
        type:"Title",
	done:true,
        init: function(sh) {
	    var i;
	    for (i=0; i<sh.weapons.length; i++) {
		if (sh.weapons[i].type=="Cannon") {
		    sh.weapons[0].isactive=false;
		    log("["+this.name+"] setting primary weapon inactive");
		    sh.weapons[i].isTurret= function() { return true; };
		    log("["+this.name+"] can fire in 360 degrees");
		    break;
		}
	    }
	},
        unique: true,
        points: 5,
        ship: "YT-2400",
    },
    {
        name: "Dauntless",
        type:"Title",
        
        unique: true,
        points: 2,
        ship: "VT-49 Decimator",
    },
    {
        name: "Virago",
        type:"Title",
	done:true,
        upgrades:["Illicit","System"],
        unique: true,
        points: 1,
	skillmin:4,
        ship: "StarViper",
    },
    {
        name: "'Heavy Scyk' Interceptor",
	done:true,
        upgrades:["Cannon|Torpedo|Missile"],
        type:"Title",
        points: 2,
        ship: "M3-A Interceptor",

    },
    {
        name: 'IG-2000',
        type:"Title",
        
        points: 0,
        ship: "Aggressor",
    },
    {
        name: "BTL-A4 Y-Wing",
        type:"Title",
	done:true,
        init: function(sh) {
	    var i;
	    for (i=0; i<sh.weapons.length; i++) if (sh.weapons[i].type=="Turret") break;
	    if (i==sh.weapons.length) return;
	    sh.weapons[i].isTurret=function() { return false; };
	    sh.isTurret=function(w) {
		if (w==sh.weapons[i]) return false;
		return Unit.prototype.isTurret(w);
	    };

	    sh.endattack=function(c,h) {
		var i;
		Unit.prototype.endattack.call(this,c,h);
		for (i=0; i<this.weapons.length; i++) if (this.weapons[i].type=="Turret") break;
		
		if (i<this.weapons.length&&this.hasfired<2&&this.weapons[this.activeweapon].isprimary) {
		    log("[BTL-A4 Y-Wing] "+this.name+" attacks again with secondary weapon");
		    waitingforaction.add(function(){ 
		    this.selecttargetforattack(i);}.bind(this))
		} 

	    };
	},
        points: 0,
        ship: "Y-Wing",
    },
    {
        name: "Andrasta",
        type:"Title",
	done:true,
        upgrades:["Bomb","Bomb"],
        unique: true,
        points: 0,
        ship: "Firespray-31",
    },
    {
        name: "TIE/x1",
        type:"Title",
	done:true,
        upgrades:["System"],
	pointsupg:-4,
        points: 0,
        ship: "TIE Advanced",
    },
];
