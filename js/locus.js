const IMPOSSIBLE_SYSTEM = null;
const INDETERMINATE_SYSTEM = "indeterminate";

class Conic {
	constructor(a, b, c, d, e, f) {
		this.a = a;
		this.b = b;
		this.c = c;
		this.d = d;
		this.e = e;
		this.f = f;
		// this.coord_sys = new CoordinateSystem(Vector.screenOrigin, Basis.screen);
		this.is_playing = false;
		this.coord_sys_from;
		this.coord_sys_to;
		this.recalculate();
	}
	recalculate() {
		this.mat = math.matrix(
			[[this.a    , this.b / 2, this.d / 2],
			 [this.b / 2, this.c    , this.e / 2],
			 [this.d / 2, this.e / 2, this.f    ]]
		);
		const check = this.b * this.b - 4 * this.a * this.c;
		if (check < 0) this.type = "eliptical";
		else if (check > 0) this.type = "hyperbolical";
		else this.type = "parabolical";
		
		const translation = this.solve_translation();
		if (translation === IMPOSSIBLE_SYSTEM) {
			[this.new_a, this.new_c, this.rotation] = this.solve_rotation();
			const new_d =  this.d * cos(this.rotation) + this.e * sin(this.rotation);
			const new_e = -this.d * sin(this.rotation) + this.e * cos(this.rotation);
			if (new_d != 0 || new_e != 0) {
				// Retry to solve translation.
				if (this.new_a == 0) {
					const transl = this.solve_vertex(-this.new_c / new_d, -new_e / new_d, -this.f / new_d);
					this.center = createVector(transl[1], transl[0]);
					this.new_f = 0;
					this.new_d = new_d;
					this.new_e = 0;
				} else {
					const transl = this.solve_vertex(-this.new_a / new_e, -new_d / new_e, -this.f / new_e);
					this.center = createVector(transl[0], transl[1]);
					this.new_f = 0;
					this.new_e = new_e;
					this.new_d = 0;
				}
			}
		} else if (translation === INDETERMINATE_SYSTEM) {
			throw new Error("Infinite translations are possible.");
		} else {
			this.new_f = this.d / 2 * translation.x + this.e / 2 * translation.y + this.f;
			[this.new_a, this.new_c, this.rotation] = this.solve_rotation();
			this.coord_sys = new CoordinateSystem(translation, Basis.fromAngle(this.rotation));
		}
	}
	toString(decimals) {
		let variables = [this.a, this.b, this.c, this.d, this.e, this.f];
		let names = ['x²', 'xy', 'y²', 'x', 'y', ''];
		let str = "";
		for (let i = 0; i < variables.length; i++) {
			if (abs(variables[i]) > 0.01) {
				if (variables[i] > 0 && str.length > 0) str += " + ";
				else if (variables[i] < 0)
					if (str.length > 0) str += " - ";
					else str += "-";
				
				if (decimals) str += abs(variables[i]).toFixed(decimals) + names[i];
				else str += abs(roundTo(variables[i], 2)).toString() + names[i];
			}
		}
		return str;
	}
	solve_vertex = (a, b, c) => [-b / (2 * a), (4 * a * c - pow(b, 2)) / (4 * a)];
	solve_translation() {
		const submatrix = this.mat.subset(math.index([0,1], [0,1]));
		// Solve translation.
		// The vector representing what each line of the system equals to [-d / 2, -e / 2]
		const equals = math.multiply(-1, this.mat.subset(math.index([0, 1], 2)));
		const result = solveLinear(submatrix, equals);
		if (result === INDETERMINATE_SYSTEM || result === IMPOSSIBLE_SYSTEM) return result;
		return new Vector(result);
	}
	solve_rotation() {
		// Solve rotation.
		if (this.b == 0) {
			this.new_a = this.a;
			this.new_c = this.c;
			const rotation = 0;
			return [this.a, this.c, rotation];
		} else {
			const cotg = (this.a - this.c) / this.b;
			const rotation = atan(sqrt(1 + pow(cotg, 2)) - cotg);
			const result = solveLinear(
				math.matrix(
					[[1, 1],
					 [1, -1]]
				),
				math.matrix(
					[this.a + this.c,
					 sqrt(1 + pow(cotg, 2)) * this.b]
				)
			);
			return result.concat(rotation);
		}
	}
	set_coordinate_system(coord_sys) { this.coord_sys = coord_sys; }
	sampleY(x) {
		if (this.type === "parabolical") {
			if (this.new_a != 0) {
				const inner = -this.new_a * pow(x, 2) / this.new_e;
				return [inner, inner];
			} else {
				const inner = -this.new_d * x / this.new_c;
				if (inner >= 0) return [sqrt(inner), -sqrt(inner)];
				return [];
			}
		} else {
			const inner = (this.new_a * pow(x, 2) + this.new_f) / -this.new_c;
			if (inner >= 0) return [sqrt(inner), -sqrt(inner)];
			return [];
		}
	}
	sampleX(y) {
		if (this.type === "parabolical") {
			if (this.new_a != 0) {
				const inner = -this.new_e * y / -this.new_a;
				return [sqrt(inner), -sqrt(inner)];
			} else {
				const inner = -this.new_c * pow(y, 2) / this.new_d;
				if (inner >= 0) return [inner, inner];
				return [];
			}
		} else {
			const inner = (this.new_c * pow(y, 2) + this.new_f) / -this.new_a;
			if (inner >= 0) return [sqrt(inner), -sqrt(inner)];
			return [];
		}
	}
	sample(n) {
		let figWidth = width;
		let figHeight = height;
		if (this.type == "eliptical")
			figWidth = scl * 2 * sqrt(-this.new_f / this.new_a);
		
		figWidth *= 2;
		figHeight *= 2;

		const plst1 = [];
		const plst2 = [];
		for (let i = 0; i < n; i++) {
			let v;
			if ((this.type === "hyperbolical" && this.new_c * this.new_f > 0) ||
				(this.type === "parabolical"  && this.new_c != 0)) {
				v = (i / n) * (height / scl) - (height / (2*scl));
			} else {
				v = (i / n) * (figWidth / scl) - (figWidth / (2*scl));
			}
			if ((this.type === "hyperbolical" && this.new_c * this.new_f > 0) ||
				(this.type === "parabolical"  && this.new_c != 0)) {
				const xs = this.sampleX(v);
				if (xs.length > 0) {
					plst1.push([xs[0], v].map(scaled));
					plst2.push([xs[1], v].map(scaled));
				}
			} else {
				const ys = this.sampleY(v);
				if (ys.length > 0) {
					plst1.push([v, ys[0]].map(scaled));
					plst2.push([v, ys[1]].map(scaled));
				}
			}
		}
		return [plst1, plst2];
	}
	get transformationMatrix() {
		return this.coord_sys;
	}
	get scenter() { return scaled(this.center); }
	retransform(plst) {
		plst = math.concat(plst, math.ones([plst.length, 1]), 1);
		return math.transpose( // Transpose list of points to original shape
			math.multiply( // Apply the rotatin matrix to all points
				this.new_coord_sys,
				math.transpose(plst) // Transpose the list of points for dot product.
			)
		).toArray();
	}
	transform(plst) {
		plst = math.concat(plst, math.ones([plst.length, 1]), 1);
		return math.transpose( // Transpose list of points to original shape
			math.multiply( // Apply the rotation matrix to all points.
				this.transformationMatrix,
				math.transpose( // Transpose the list of points for dot product.
					plst // Get points in the retransformed (original) form.
				)
			)
		).toArray()
	}
	applyMatrix() {
		let mat = this.transformationMatrix.toArray();
		applyMatrix(
			mat[0][0], mat[1][0],
			mat[0][1], mat[1][1],
			scaled(mat[0][2]), scaled(mat[1][2]),
		);
	}
	draw() {
		push();
		this.applyMatrix();
		if (this.type == "eliptical") {
			const A = 2 * sqrt(-this.new_f / this.new_a);
			const B = 2 * sqrt(-this.new_f / this.new_c);
			ellipse(0, 0, scaled(A), scaled(B));
		} else {
			const n = 1000;
			let [plst1, plst2] = this.sample(n);
			if (this.type == "hyperbolical") {
				beginShape();
				plst1.forEach(vec => curveVertex(vec[0], vec[1]));
				endShape();
				beginShape();
				plst2.forEach(vec => curveVertex(vec[0], vec[1]));
				endShape();
			} else {
				beginShape();
				plst1.forEach(vec => curveVertex(vec[0], vec[1]));
				endShape();
				beginShape();
				plst2.forEach(vec => curveVertex(vec[0], vec[1]));
				endShape();
			}
		}
		pop();
	}
	animateCoordSystemChange(coord_sys_to, step, finish_callback, lerp=0) {
		if (coord_sys_to) {
			this.coord_sys_from = this.coord_sys.copy();
			this.coord_sys_to = coord_sys_to;
			this.is_playing = true;
		} else {
			this.coord_sys = CoordinateSystem.lerp(this.coord_sys_from, this.coord_sys_to, lerp);
			[this.a, this.b, this.c, this.d, this.e, this.f] = this.get_equation_for(this.coord_sys);
		}
		if (lerp < 1) window.requestAnimationFrame(() => this.animateCoordSystemChange(null, step, finish_callback, lerp + step));
		else {
			this.is_playing = false;
			[this.a, this.b, this.c, this.d, this.e, this.f] = this.get_equation_for(this.coord_sys_to);
			this.recalculate();
			
			if (finish_callback) window.requestAnimationFrame(finish_callback);
		}
	}
	get_equation_for(new_coord_sys) {
		const sys = new_coord_sys.inv();
		const i = sys.basis.i;
		const j = sys.basis.j;
		const o = sys.origin;

		if (!this.new_a) this.new_a = 0;
		if (!this.new_b) this.new_b = 0;
		if (!this.new_c) this.new_c = 0;
		if (!this.new_d) this.new_d = 0;
		if (!this.new_e) this.new_e = 0;

		const a = this.new_a * pow(i.x, 2) + this.new_b * i.x * i.y + this.new_c * pow(i.y, 2);
		const b = 2 * this.new_a * i.x * j.x + this.new_b * (i.x * j.y + i.y * j.x) + 2 * this.new_c * i.y * j.y;
		const c = this.new_a * pow(j.x, 2) + this.new_b * j.x * j.y + this.new_c * pow(j.y, 2);
		const d = 2 * this.new_a * o.x * i.x + this.new_b * (o.x * i.y + o.y * i.x) + 2 * this.new_c * o.y * i.y + this.new_d * i.x + this.new_e * i.y;
		const e = 2 * this.new_a * o.x * j.x + this.new_b * (o.x * j.y + o.y * j.x) + 2 * this.new_c * o.y * j.y + this.new_d * j.x + this.new_e * j.y;
		const f = this.new_a * pow(o.x, 2) + this.new_b * o.x * o.y + this.new_c * pow(o.y, 2) + this.new_d * o.x + this.new_e * o.y + this.new_f;

		// const a = this.a * pow(i.x, 2) + this.b * i.x * i.y + this.c * pow(i.y, 2);
		// const b = 2 * this.a * i.x * j.x + this.b * (i.x * j.y + i.y * j.x) + 2 * this.c * i.y * j.y;
		// const c = this.a * pow(j.x, 2) + this.b * j.x * j.y + this.c * pow(j.y, 2);
		// const d = 2 * this.a * o.x * i.x + this.b * (o.x * i.y + o.y * i.x) + 2 * this.c * o.y * i.y + this.d * i.x + this.e * i.y;
		// const e = 2 * this.a * o.x * j.x + this.b * (o.x * j.y + o.y * j.x) + 2 * this.c * o.y * j.y + this.d * j.x + this.e * j.y;
		// const f = this.a * pow(o.x, 2) + this.b * o.x * o.y + this.c * pow(o.y, 2) + this.d * o.x + this.e * o.y + this.f;
		return [a, b, c, d, e, f];
	}
	/*
	get_equation_for(origin, ang) {
		// const [h, k, _] = math.multiply(math.inv(this.coord_sys), [origin.x, origin.y, 1]).toArray();
		const h = origin.x;
		const k = origin.y;

		if (!this.new_a) this.new_a = 0;
		if (!this.new_b) this.new_b = 0;
		if (!this.new_c) this.new_c = 0;
		if (!this.new_d) this.new_d = 0;
		if (!this.new_e) this.new_e = 0;

		const a = this.new_a * pow(cos(ang), 2) + this.new_b * sin(ang) * cos(ang) + this.new_c * pow(sin(ang), 2);
		const b = -2 * this.new_a * sin(ang) * cos(ang) + this.new_b * (pow(cos(ang), 2) - pow(sin(ang), 2)) + 2 * this.new_c * sin(ang) * cos(ang);
		const c = this.new_a * pow(sin(ang), 2) - this.new_b * sin(ang) * cos(ang) + this.new_c * pow(cos(ang), 2);
		const d =  2 * this.new_a * h * cos(ang) + this.new_b * (h * sin(ang) + k * cos(ang)) + 2 * this.new_c * k * sin(ang) + this.new_d * cos(ang) + this.new_e * sin(ang);
		const e = -2 * this.new_a * h * sin(ang) + this.new_b * (h * cos(ang) - k * sin(ang)) + 2 * this.new_c * k * cos(ang) - this.new_d * sin(ang) + this.new_e * cos(ang);
		const f = this.new_a * pow(h, 2) + this.new_b * h * k + this.new_c * pow(k, 2) + this.new_d * h + this.new_e * k + this.new_f;
		return [a, b, c, d, e, f];
	}
	*/
}

function solveLinear(mat, vec) {
	if (mat.size().length != 2)
		throw new Error("Matrix must be 2 dimentional.");
	if (mat.size()[0] != mat.size()[1])
		throw new Error("Matrix must be square.");
	if (vec.size().length == 1 && mat.size()[1] != vec.size()[0])
		throw new Error(`Dimesion missmatch in second argument of solveLinear(), expected ${mat.size()[1]} but got ${vec.size()[0]}.`);

	const result = [];
	const D = math.det(mat);
	for (let i = 0; i < mat.size()[0]; i++) {
		// Select the desired row of the matrix and replace it with the "answer vector".
		const partialMat = math.subset(
			mat,
			math.index(math.range(0, mat.size()[1]), i),
			vec
		);
		const partialDet = math.det(partialMat);
		if (D == 0 && partialDet != 0) {
			console.warn("Impossible system.")
			return IMPOSSIBLE_SYSTEM;
		} else if (D != 0) {
			result.push(partialDet / D);
		}
	}
	if (D == 0) {
		console.warn("Indeterminate system.");
		return INDETERMINATE_SYSTEM;
	}
	return result;
}