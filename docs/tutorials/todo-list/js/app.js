(function() {
	'use strict';

	var todos = [],
		stat = {},
		ENTER_KEY = 13,
		db = null,
		todos = {},
		dbname = 'idb://todos',
		remote = 'http://127.0.0.1:2020/todos';

	window.addEventListener( 'load', loadPouch, false );

	function Todo( title, completed ) {
		this._id = getUuid();
		this.title = title;
		this.completed = completed;
		this.created = Date.now();
	}

	function Stat() {
		this.todoLeft = 0;
		this.todoCompleted = 0;
		this.totalTodo = 0;
	}

	function loadPouch() {
		//Pouch.destroy(dbname);
		Pouch(dbname, function(err, pouchdb){
			if(err){
				alert('Can\'t open pouchdb database');
			}else{
				document.getElementById('push').addEventListener('click', function(){
					var orig = this.innerHTML;
					var that = this;
					this.innerHTML = "working";
					Pouch.replicate(dbname, remote, function(err, changes){
						if(!err){
							that.innerHTML = "synced";
						}else{
							that.innerHTML = "failed";
						}
						setTimeout(function(){
							that.innerHTML = orig;
						}, 1000);
					});
				}, false);

				document.getElementById('get').addEventListener('click', function(){
					var orig = this.innerHTML;
					var that = this;
					this.innerHTML = "working";
					Pouch.replicate(remote, dbname, function(err, changes){
						if(!err){
							loadData();
						}else{
							console.log('Replication get error');
						}
						that.innerHTML = orig;
					});
				}, false);
				
				db = pouchdb;
				windowLoadHandler();
			}
		});
	}

	function loadData(){
		db.allDocs({include_docs: true}, function(err, res){
			var i, todo;
			if(!err){
				todos = {};
				for(i = 0; i < res.rows.length; i++){
					todo = res.rows[i].doc;
					todos[todo._id] = todo;
				}
				refreshData();
			}else{
				console.log('Error getting all docs');
			}
		});
	}

	function windowLoadHandler() {
		loadData();
		addEventListeners();
	}

	function addEventListeners() {
		document.getElementById('new-todo').addEventListener( 'keypress', newTodoKeyPressHandler, false );
		document.getElementById('toggle-all').addEventListener( 'change', toggleAllChangeHandler, false );
	}

	function inputEditTodoKeyPressHandler( event ) {
		var inputEditTodo = event.target,
			trimmedText = inputEditTodo.value.trim(),
			todoId = event.target.id.slice( 6 );

		if ( trimmedText ) {
			if ( event.keyCode === ENTER_KEY ) {
				editTodo( todoId, {'title': trimmedText} );
			}
		} else {
			removeTodoById( todoId );
		}
	}

	function inputEditTodoBlurHandler( event ) {
		var inputEditTodo = event.target,
			todoId = event.target.id.slice( 6 );

		editTodo( todoId, {'title': inputEditTodo.value} );
	}

	function newTodoKeyPressHandler( event ) {
		if ( event.keyCode === ENTER_KEY ) {
			addTodo( document.getElementById('new-todo').value );
		}
	}

	function toggleAllChangeHandler( event ) {
		var i, todo;
		for(i in todos){
			if(todos.hasOwnProperty(i)){
				var todo = todos[i];
				editTodo(todo._id, {'completed': event.target.checked});
			}
		}
	}

	function spanDeleteClickHandler( event ) {
		removeTodoById( event.target.getAttribute('data-todo-id') );
	}

	function hrefClearClickHandler() {
		removeTodosCompleted();
		refreshData();
	}

	function todoContentHandler( event ) {
		var todoId = event.target.getAttribute('data-todo-id'),
			div = document.getElementById( 'li_' + todoId ),
			inputEditTodo = document.getElementById( 'input_' + todoId );

		div.className = 'editing';
		inputEditTodo.focus();
	}

	function checkboxChangeHandler( event ) {
		var checkbox = event.target,
			todoId = checkbox.getAttribute('data-todo-id');
		editTodo( todoId, {'completed': checkbox.checked} );
	}

	function addTodo( text ) {
		var trimmedText = text.trim();

		if ( trimmedText ) {
			var todo = new Todo( trimmedText, false );
		}

		db.post(todo, function(err, res){
			if(!err){
				console.log('Todo added', todo._id);
				todos[todo._id] = todo;
				console.log(todo)
				refreshData();
			}else{
				console.log('Add failed', err);
			}
		});
	}

	/* opt: text, completed */
	function editTodo( todoId, opt ) {

		db.get(todoId, function(err, todo){
			console.log(todo);
			if('title' in opt){
				todo.title = opt.title;
			}
			if('completed' in opt){
				todo.completed = opt.completed;
			}
			db.put(todo, function(err, res){
				if(!err){
					console.log('Todo edited', opt);
					todos[todoId] = todo;
					refreshData();
				}else{
					console.log('Edit failed');
				}
			});
		});
	}

	function removeTodoById( todoId ) {
		db.get(todoId, function(err, res){
			db.remove(res, function(err, res){
				if(!err){
					console.log('Todo removed');
					delete todos[todoId];
					refreshData();
				}else{
					console.log('Remove failed');
				}
			});
		});
	}

	function removeTodosCompleted() {
		var i, todo;
		for(i in todos){
			if(todos.hasOwnProperty(i)){
				var todo = todos[i];
				if(todo.completed){
					removeTodoById(todo._id);
				}
			}
		}
	}

	function refreshData() {
		var todosArr = [];
		var i, todo;
		for(i in todos){
			if(todos.hasOwnProperty(i)){
				todo = todos[i];
				todosArr.push(todo);
			}
		}
		todosArr.sort(function(a, b){
			return a.created - b.created;
		});
		computeStats(todosArr);
		redrawTodosUI(todosArr);
		redrawStatsUI(todosArr);
		changeToggleAllCheckboxState(todosArr);
	}

	function computeStats(todos) {
		var i, l;

		stat = new Stat();
		stat.totalTodo = todos.length;

		for ( i = 0, l = todos.length; i < l; i++ ) {
			if ( todos[ i ].completed ) {
				stat.todoCompleted++;
			}
		}

		stat.todoLeft = stat.totalTodo - stat.todoCompleted;
	}


	function redrawTodosUI(todos) {
		var todo, checkbox, label, deleteLink, divDisplay, inputEditTodo, li, i, l,
				ul = document.getElementById('todo-list');

		document.getElementById('main').style.display = todos.length ? 'block' : 'none';

		ul.innerHTML = '';
		document.getElementById('new-todo').value = '';

		for ( i = 0, l = todos.length; i < l; i++ ) {
			todo = todos[ i ];

			// create checkbox
			checkbox = document.createElement('input');
			checkbox.className = 'toggle';
			checkbox.setAttribute( 'data-todo-id', todo._id );
			checkbox.type = 'checkbox';
			checkbox.addEventListener( 'change', checkboxChangeHandler );

			// create div text
			label = document.createElement('label');
			label.setAttribute( 'data-todo-id', todo._id );
			label.appendChild( document.createTextNode( todo.title ) );
			label.addEventListener( 'dblclick', todoContentHandler );


			// create delete button
			deleteLink = document.createElement('button');
			deleteLink.className = 'destroy';
			deleteLink.setAttribute( 'data-todo-id', todo._id );
			deleteLink.addEventListener( 'click', spanDeleteClickHandler );

			// create divDisplay
			divDisplay = document.createElement('div');
			divDisplay.className = 'view';
			divDisplay.setAttribute( 'data-todo-id', todo._id );
			divDisplay.appendChild( checkbox );
			divDisplay.appendChild( label );
			divDisplay.appendChild( deleteLink );

			// create todo input
			inputEditTodo = document.createElement('input');
			inputEditTodo.id = 'input_' + todo._id;
			inputEditTodo.className = 'edit';
			inputEditTodo.value = todo.title;
			inputEditTodo.addEventListener( 'keypress', inputEditTodoKeyPressHandler );
			inputEditTodo.addEventListener( 'blur', inputEditTodoBlurHandler );


			// create li
			li = document.createElement('li');
			li.id = 'li_' + todo._id;
			li.appendChild( divDisplay );
			li.appendChild( inputEditTodo );


			if ( todo.completed ) {
				li.className += 'complete';
				checkbox.checked = true;
			}

			ul.appendChild( li );
		}
	}

	function changeToggleAllCheckboxState(todos) {
		var toggleAll = document.getElementById('toggle-all');

		toggleAll.checked = stat.todoCompleted === todos.length;
	}

	function redrawStatsUI(todos) {
		removeChildren( document.getElementsByTagName('footer')[0] );
		document.getElementById('footer').style.display = todos.length ? 'block' : 'none';

		if ( stat.todoCompleted ) {
			drawTodoClear();
		}

		if ( stat.totalTodo ) {
			drawTodoCount();
		}
	}

	function drawTodoCount() {
		var number = document.createElement('strong'),
				remaining = document.createElement('span'),
				text = ' ' + ( stat.todoLeft === 1 ? 'item' : 'items' ) + ' left';

		// create remaining count
		number.innerHTML = stat.todoLeft;

		remaining.id = 'todo-count';
		remaining.appendChild( number );
		remaining.appendChild( document.createTextNode( text ) );

		document.getElementsByTagName('footer')[0].appendChild( remaining );
	}

	function drawTodoClear() {
		var buttonClear = document.createElement('button');

		buttonClear.id = 'clear-completed';
		buttonClear.addEventListener( 'click', hrefClearClickHandler );
		buttonClear.innerHTML = 'Clear completed (' + stat.todoCompleted + ')';

		document.getElementsByTagName('footer')[0].appendChild( buttonClear );
	}

	function removeChildren( node ) {
		node.innerHTML = '';
	}

	function getUuid() {
		var i, random,
		uuid = '';

		for ( i = 0; i < 32; i++ ) {
			random = Math.random() * 16 | 0;
			if ( i === 8 || i === 12 || i === 16 || i === 20 ) {
				uuid += '-';
			}
			uuid += ( i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random) ).toString( 16 );
			}
		return uuid;
	}
})();
